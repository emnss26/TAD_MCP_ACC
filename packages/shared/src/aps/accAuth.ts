import http from "node:http";
import { mustGetEnv, getScopesFromEnv } from "./env.js";
import { createPkcePair, randomString } from "./pkce.js";
import { buildAuthorizeUrl, exchangeCodeForToken, refreshToken, fetchUserProfile } from "./oauthClient.js";
import { readTokens, writeTokens, clearTokens, type StoredTokens } from "./tokenStore.js";

export type AccAuthStatus =
  | { loggedIn: false; pendingLogin: boolean; message: string }
  | { loggedIn: true; pendingLogin: boolean; expiresAt: string; profile?: StoredTokens["profile"] };

const DEFAULT_SCOPES = ["data:read"]; // para Issues read-only (amplías con APS_SCOPES)
const EXP_SKEW_SECONDS = 60;

let pending: {
  server: http.Server;
  redirectUri: string;
  state: string;
  verifier: string;
  scopes: string[];
} | null = null;

function isExpired(tokens: StoredTokens): boolean {
  const expiresAtMs = tokens.obtained_at + tokens.expires_in * 1000;
  return Date.now() > (expiresAtMs - EXP_SKEW_SECONDS * 1000);
}

export async function startAccLogin(): Promise<{ authorizationUrl: string; redirectUri: string; note: string }> {
  const clientId = mustGetEnv("APS_CLIENT_ID");
  const scopes = getScopesFromEnv(DEFAULT_SCOPES);

  // si ya hay login corriendo, re-usa
  if (pending) {
    return {
      authorizationUrl: buildAuthorizeUrl({
        clientId,
        redirectUri: pending.redirectUri,
        scopes: pending.scopes,
        state: pending.state,
        codeChallenge: createPkcePair().challenge // (no se usa realmente aquí, pero no pasa nada)
      }),
      redirectUri: pending.redirectUri,
      note: "Ya había un login pendiente. Usa el URL y completa el flujo en el navegador."
    };
  }

  const { verifier, challenge } = createPkcePair();
  const state = randomString(16);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname !== "/callback") {
        res.writeHead(404).end("Not found");
        return;
      }

      const code = url.searchParams.get("code");
      const gotState = url.searchParams.get("state");
      const err = url.searchParams.get("error");

      if (err) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h1>Auth error</h1><p>${err}</p>`);
        return;
      }
      if (!code || !gotState || !pending || gotState !== pending.state) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h1>Invalid callback</h1><p>Missing code/state or state mismatch.</p>");
        return;
      }

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

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h1>✅ Listo</h1><p>Ya puedes volver a Claude y ejecutar tools (Issues, etc.).</p>");

    } catch (e: any) {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(`<h1>Server error</h1><pre>${String(e?.message ?? e)}</pre>`);
    } finally {
      // cerrar server al primer callback válido o error grave
      if (pending) {
        pending.server.close();
        pending = null;
      }
    }
  });

  // puerto random
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("Failed to bind local callback server");

  const redirectUri = `http://127.0.0.1:${addr.port}/callback`;

  pending = { server, redirectUri, state, verifier, scopes };

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
    note: "Abre el URL en tu navegador. Cuando termine, regresa a Claude y corre acc_auth_status o acc_issues_list."
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