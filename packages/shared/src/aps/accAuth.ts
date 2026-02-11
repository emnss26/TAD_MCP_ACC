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
  redirectUri: string;
  state: string;
  verifier: string;
  challenge: string;
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
  const v = process.env.APS_CALLBACK_URL ?? process.env.APS_REDIRECT_URI ?? mustGetEnv("APS_CALLBACK_URL");
  return String(v).replace(/^'+|'+$/g, "").trim();
}

export async function startAccLogin() {
  const clientId = mustGetEnv("APS_CLIENT_ID");
  const scopes = getScopesFromEnv(DEFAULT_SCOPES);

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
      note: "Ya hay un login pendiente. Abre el URL arriba."
    };
  }

  const redirectUri = getRedirectUriFromEnv();
  const ru = new URL(redirectUri);
  const port = Number(ru.port || "0");
  
  if (!port) throw new Error(`APS_CALLBACK_URL requiere puerto (ej: :8787)`);

  const callbackPath = ru.pathname || "/callback";
  const state = randomString(32);
  const { verifier, challenge } = createPkcePair();

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

      if (url.pathname !== callbackPath) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const code = url.searchParams.get("code");
      const gotState = url.searchParams.get("state");

      if (!pending || !code || gotState !== pending.state) {
        res.writeHead(400);
        res.end("Invalid state or missing code");
        return;
      }

      const token = await exchangeCodeForToken({
        code,
        redirectUri: pending.redirectUri,
        codeVerifier: pending.verifier,
        scopes: pending.scopes
      });

      const profile = await fetchUserProfile(token.access_token);
      await writeTokens({ ...token, obtained_at: Date.now(), profile });

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:50px;">
                <h1 style="color:green;">✅ Login Successful</h1>
                <p>Tokens guardados automáticamente. Ya puedes cerrar esta pestaña y volver a Claude.</p>
              </body></html>`);
    } catch (e: any) {
      res.writeHead(500);
      res.end(`Error: ${e.message}`);
    } finally {
      if (pending) {
        pending.server.close();
        pending = null;
      }
    }
  });

  await new Promise<void>((resolve) => server.listen(port, () => resolve()));

  pending = { server, redirectUri, state, verifier, challenge, scopes, callbackPath };

  return {
    authorizationUrl: buildAuthorizeUrl({ clientId, redirectUri, scopes, state, codeChallenge: challenge }),
    redirectUri,
    note: "El servidor de callback está activo. Al autorizar, se guardará el token."
  };
}

export async function getAccAuthStatus(): Promise<AccAuthStatus> {
  const tokens = await readTokens();
  if (!tokens) {
    return {
      loggedIn: false,
      pendingLogin: !!pending,
      message: pending ? "Login en curso..." : "No hay sesión activa."
    };
  }
  const expiresAtMs = tokens.obtained_at + tokens.expires_in * 1000;
  return {
    loggedIn: true,
    pendingLogin: !!pending,
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
  const tokens = await readTokens();
  if (!tokens) throw new Error("No hay sesión activa. Ejecuta acc_auth_start.");

  if (!isExpired(tokens)) return tokens.access_token;

  const refreshed = await refreshToken({
    refreshToken: tokens.refresh_token,
    scopes: getScopesFromEnv(DEFAULT_SCOPES)
  });

  const updated = { ...refreshed, obtained_at: Date.now(), profile: tokens.profile };
  await writeTokens(updated);
  return refreshed.access_token;
}