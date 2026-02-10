import http from "node:http";
import { URL } from "node:url";

import { mustGetEnv, getScopesFromEnv } from "./env.js";
import { createPkcePair } from "./pkce.js";
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

const DEFAULT_SCOPES = ["data:read", "account:read"];
const EXP_SKEW_SECONDS = 60;

let pending: {
  server: http.Server;
  redirectUri: string;   // fijo, viene de env
  state: string;
  verifier: string;      // PKCE verifier
  challenge: string;     // PKCE challenge
  scopes: string[];
  callbackPath: string;
} | null = null;

function randomString(len = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function isExpired(tokens: StoredTokens): boolean {
  const expiresAtMs = tokens.obtained_at + tokens.expires_in * 1000;
  return Date.now() > (expiresAtMs - EXP_SKEW_SECONDS * 1000);
}

function getRedirectUriFromEnv(): string {
  const v =
    process.env.APS_CALLBACK_URL ??
    process.env.APS_REDIRECT_URI ??
    mustGetEnv("APS_CALLBACK_URL");

  return String(v).replace(/^'+|'+$/g, "").trim();
}

export async function startAccLogin(): Promise<{
  authorizationUrl: string;
  redirectUri: string;
  note: string;
}> {
  const clientId = mustGetEnv("APS_CLIENT_ID");
  const scopes = getScopesFromEnv(DEFAULT_SCOPES);

  // Si ya hay login pendiente, NO generes PKCE nuevo (debe matchear el que se usará al intercambiar el code)
  if (pending) {
    return {
      authorizationUrl: buildAuthorizeUrl({
        clientId,
        redirectUri: pending.redirectUri,
        scopes: pending.scopes,
        state: pending.state,
        codeChallenge: pending.challenge
      }),
      redirectUri: pending.redirectUri,
      note: "Ya hay un login pendiente. Abre el URL y completa el flujo en el navegador."
    };
  }

  const redirectUri = getRedirectUriFromEnv();
  const ru = new URL(redirectUri);

  const port = Number(ru.port || "0");
  if (!port) {
    throw new Error(
      `APS_CALLBACK_URL debe incluir puerto. Ej: http://localhost:8787/callback (actual: ${redirectUri})`
    );
  }

  const callbackPath = ru.pathname || "/callback";
  const state = randomString(32);

  // ✅ PKCE: generar y guardar
  const { verifier, challenge } = createPkcePair();

  const server = http.createServer(async (req, res) => {
    try {
      const base = `${ru.protocol}//${ru.host}`;
      const url = new URL(req.url ?? "/", base);

      // Health para debug: abre http://localhost:8787/ y debe responder
      if (url.pathname === "/" || url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("ACC Auth callback server is running ✅");
        return;
      }

      if (url.pathname !== callbackPath) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const err = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      const gotState = url.searchParams.get("state");

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

      // ✅ Intercambio code -> token (requiere codeVerifier)
      const token = await exchangeCodeForToken({
        code,
        redirectUri: pending.redirectUri,
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
          <body style="font-family: sans-serif; text-align: center; padding: 40px;">
            <h1 style="color: #16a34a;">✅ Login successful</h1>
            <p>Token y refresh token guardados. Ya puedes volver a Claude.</p>
          </body>
        </html>
      `);
    } catch (e: any) {
      res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<h1>Server error</h1><pre>${String(e?.message ?? e)}</pre>`);
    } finally {
      if (pending) {
        pending.server.close();
        pending = null;
      }
    }
  });

  // ✅ Puerto fijo del callback
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => resolve());
  });

  pending = { server, redirectUri, state, verifier, challenge, scopes, callbackPath };

  const authorizationUrl = buildAuthorizeUrl({
    clientId,
    redirectUri,
    scopes,
    state,
    codeChallenge: challenge
  });

  return {
    authorizationUrl,
    redirectUri,
    note:
      "Abre el URL, autoriza y verás 'Login successful'. Luego corre acc_auth_status o acc_issues_list (sin copiar códigos)."
  };
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
  if (pending) {
    pending.server.close();
    pending = null;
  }
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
