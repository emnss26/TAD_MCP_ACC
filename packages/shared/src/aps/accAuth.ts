import http from "node:http";
import { URL } from "node:url";

import { mustGetEnv, getCallbackUrl, getScopesFromEnv } from "./env.js";
import { createPkcePair, randomString } from "./pkce.js";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  refreshToken,
  fetchUserProfile
} from "./oauthClient.js";
import { readTokens, writeTokens, clearTokens, type StoredTokens } from "./tokenStore.js";

export type AccAuthStatus =
  | { loggedIn: false; pendingLogin: boolean; message: string }
  | { loggedIn: true; pendingLogin: boolean; expiresAt: string; profile?: StoredTokens["profile"] };

const DEFAULT_SCOPES = ["data:read"]; // fallback si APS_SCOPES no existe
const EXP_SKEW_SECONDS = 60;

let pending:
  | {
      server: http.Server;
      state: string;
      verifier: string;
      challenge: string;
      scopes: string[];
      callbackUrl: string;
      callbackPath: string;
      timeout: NodeJS.Timeout;
    }
  | null = null;

function isExpired(tokens: StoredTokens): boolean {
  const expiresAtMs = tokens.obtained_at + tokens.expires_in * 1000;
  return Date.now() > expiresAtMs - EXP_SKEW_SECONDS * 1000;
}

export async function startAccLogin(): Promise<{
  authorizationUrl: string;
  redirectUri: string;
  note: string;
}> {
  const clientId = mustGetEnv("APS_CLIENT_ID");
  const callbackUrl = getCallbackUrl(); // <-- APS_CALLBACK_URL fijo
  const scopes = getScopesFromEnv(DEFAULT_SCOPES);

  // Si ya hay login pendiente, reusamos el mismo (no levantamos otro server)
  if (pending) {
    const authorizationUrl = buildAuthorizeUrl({
      clientId,
      redirectUri: pending.callbackUrl,
      scopes: pending.scopes,
      state: pending.state,
      codeChallenge: pending.challenge
    });

    return {
      authorizationUrl,
      redirectUri: pending.callbackUrl,
      note: "Ya había un login pendiente. Abre el URL y termina el flujo."
    };
  }

  const cb = new URL(callbackUrl);
  const callbackPath = cb.pathname || "/callback";
  const port = cb.port ? Number(cb.port) : 8787;

  const { verifier, challenge } = createPkcePair();
  const state = randomString(16);

  const server = http.createServer(async (req, res) => {
    // IMPORTANTÍSIMO: NO cierres el server por requests que no sean el callback.
    try {
      const reqUrl = new URL(req.url ?? "/", `${cb.protocol}//${cb.host}`);

      if (reqUrl.pathname !== callbackPath) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const err = reqUrl.searchParams.get("error");
      const code = reqUrl.searchParams.get("code");
      const gotState = reqUrl.searchParams.get("state");

      if (err) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<h1>Auth error</h1><p>${err}</p>`);
        return;
      }

      if (!pending || !code || !gotState || gotState !== pending.state) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>Invalid callback</h1><p>Missing code/state or state mismatch.</p>");
        return;
      }

      const token = await exchangeCodeForToken({
        code,
        redirectUri: pending.callbackUrl,
        codeVerifier: pending.verifier,
        scopes: pending.scopes
      });

      const obtained_at = Date.now();
      const profile = await fetchUserProfile(token.access_token);

      await writeTokens({
        ...token,
        obtained_at,
        profile
      });

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <html>
          <body style="font-family: sans-serif; text-align:center; padding:50px;">
            <h1 style="color: #16a34a;">✅ Login successful</h1>
            <p>Tokens guardados. Puedes cerrar esta ventana y volver a Claude.</p>
            <script>try{window.close();}catch(e){}</script>
          </body>
        </html>
      `);

      // Cerrar flujo sólo después de éxito
      cleanupPending();
    } catch (e: any) {
      res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<h1>Server error</h1><pre>${String(e?.message ?? e)}</pre>`);
      cleanupPending();
    }
  });

  // Escucha en el puerto fijo. OJO: NO fijamos host para que "localhost" funcione bien (IPv4/IPv6).
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => resolve());
  });

  // Timeout para no dejar un server colgado si el usuario se va por café
  const timeout = setTimeout(() => cleanupPending(), 10 * 60 * 1000);

  pending = {
    server,
    state,
    verifier,
    challenge,
    scopes,
    callbackUrl,
    callbackPath,
    timeout
  };

  const authorizationUrl = buildAuthorizeUrl({
    clientId,
    redirectUri: callbackUrl,
    scopes,
    state,
    codeChallenge: challenge
  });

  return {
    authorizationUrl,
    redirectUri: callbackUrl,
    note: `Abre el URL. Al aprobar, verás "Login successful" en ${callbackUrl}. Luego corre acc_auth_status o acc_issues_list.`
  };
}

function cleanupPending() {
  if (!pending) return;
  clearTimeout(pending.timeout);
  try {
    pending.server.close();
  } catch {}
  pending = null;
}

export async function getAccAuthStatus(): Promise<AccAuthStatus> {
  const tokens = await readTokens();
  if (!tokens) {
    return {
      loggedIn: false,
      pendingLogin: Boolean(pending),
      message: pending ? "Hay un login pendiente. Completa el navegador." : "No hay sesión. Corre acc_auth_start."
    };
  }

  const expiresAtMs = tokens.obtained_at + tokens.expires_in * 1000;
  return {
    loggedIn: true,
    pendingLogin: Boolean(pending),
    expiresAt: new Date(expiresAtMs).toISOString(),
    profile: tokens.profile
  };
}

export async function logoutAcc(): Promise<{ ok: true }> {
  cleanupPending();
  await clearTokens();
  return { ok: true };
}

export async function getAccAccessToken(): Promise<string> {
  const scopes = getScopesFromEnv(DEFAULT_SCOPES);
  const tokens = await readTokens();
  if (!tokens) throw new Error("Not logged in. Run acc_auth_start first.");

  if (!isExpired(tokens)) return tokens.access_token;

  const refreshed = await refreshToken({
    refreshToken: tokens.refresh_token,
    scopes
  });

  const obtained_at = Date.now();
  const profile = tokens.profile ?? (await fetchUserProfile(refreshed.access_token));

  await writeTokens({
    ...refreshed,
    obtained_at,
    profile
  });

  return refreshed.access_token;
}
