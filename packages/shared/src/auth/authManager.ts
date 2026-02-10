import crypto from "node:crypto";
import { getContext, setContext } from "../config/contextStore.js";
import type {
  ApsTokenResponse,
  AuthStatus,
  StartLoginResult,
  StoredAccSession
} from "./types.js";

const AUTH_BASE = "https://developer.api.autodesk.com/authentication/v2";
const AUTHORIZE_URL = `${AUTH_BASE}/authorize`;
const TOKEN_URL = `${AUTH_BASE}/token`;

function requiredEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getClient() {
  return {
    clientId: requiredEnv("APS_CLIENT_ID"),
    clientSecret: requiredEnv("APS_CLIENT_SECRET"),
    redirectUri: requiredEnv("APS_CALLBACK_URL")
  };
}

function getScope(): string {
  // Puedes controlar esto por env; default razonable
  return (process.env.APS_SCOPES?.trim() ||
    "data:read data:write account:read") as string;
}

function randomState(): string {
  return crypto.randomBytes(16).toString("hex");
}

function nowMs() {
  return Date.now();
}

function encodeBasicAuth(user: string, pass: string) {
  return Buffer.from(`${user}:${pass}`).toString("base64");
}

function formUrlEncode(body: Record<string, string>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) p.set(k, v);
  return p.toString();
}

export function saveSession(session: StoredAccSession) {
  setContext({ acc: { session } });
}

export function loadSession(): StoredAccSession | null {
  const ctx = getContext() as any;
  return ctx?.acc?.session ?? null;
}

export async function beginLogin(): Promise<StartLoginResult> {
  const { clientId, redirectUri } = getClient();
  const state = randomState();
  const scope = getScope();

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);

  // guardamos state para validar completion (simple)
  setContext({ acc: { pending: { state, redirectUri, scope, createdAt: nowMs() } } });

  const instructions =
    "1) Abre el URL en tu navegador y autoriza.\n" +
    "2) Te redirigirá a tu redirect_uri con ?code=...\n" +
    "3) Copia el URL completo o solo el code y ejecútalo en el tool: acc_auth_login";

  const note =
    "Tip: si copias el URL completo, yo extraigo el code automáticamente. " +
    "Sí, Windows te va a meter CRLF… pero al token endpoint no le importa 😄";

  return {
    url: url.toString(),
    authorizationUrl: url.toString(),
    state,
    scope,
    redirectUri,
    instructions,
    note
  };
}

export async function completeLogin(args: { codeOrUrl: string }) {
  const { clientId, clientSecret, redirectUri } = getClient();

  const ctx = getContext() as any;
  const pending = ctx?.acc?.pending;

  const code = extractCode(args.codeOrUrl);
  if (!code) throw new Error("No code found. Provide the redirected URL or the code value.");

  // (opcional) valida state si viene en url
  const state = extractState(args.codeOrUrl);
  if (pending?.state && state && pending.state !== state) {
    throw new Error("State mismatch. Run acc_auth_start again.");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${encodeBasicAuth(clientId, clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formUrlEncode({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri
    })
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`APS token error ${res.status}: ${text}`);
  }

  const token = JSON.parse(text) as ApsTokenResponse;

  const expiresAt = nowMs() + Math.max(0, (token.expires_in - 60)) * 1000;

  const session: StoredAccSession = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt,
    scope: token.scope,
    tokenType: token.token_type
  };

  saveSession(session);

  // limpia pending
  setContext({ acc: { session, pending: null } });

  return token;
}

export function getAuthStatus(): AuthStatus {
  const session = loadSession();
  if (!session) return { loggedIn: false };
  const valid = session.expiresAt > nowMs();
  return {
    loggedIn: !!session.accessToken,
    expiresAt: session.expiresAt,
    scope: session.scope
  };
}

export function logout() {
  setContext({ acc: { session: null, pending: null } });
}

export async function ensureAccessToken(): Promise<string> {
  const { clientId, clientSecret } = getClient();
  const session = loadSession();

  if (!session) {
    throw new Error("Not logged in. Run acc_auth_start then acc_auth_login.");
  }

  // todavía válido
  if (session.expiresAt > nowMs() && session.accessToken) return session.accessToken;

  if (!session.refreshToken) {
    throw new Error("No refresh token found. Run login again (acc_auth_start).");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${encodeBasicAuth(clientId, clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formUrlEncode({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken
    })
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`APS refresh error ${res.status}: ${text}`);
  }

  const token = JSON.parse(text) as ApsTokenResponse;

  const expiresAt = nowMs() + Math.max(0, (token.expires_in - 60)) * 1000;

  const next: StoredAccSession = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? session.refreshToken,
    expiresAt,
    scope: token.scope ?? session.scope,
    tokenType: token.token_type ?? session.tokenType
  };

  saveSession(next);

  return next.accessToken;
}

function extractCode(codeOrUrl: string): string | null {
  try {
    if (codeOrUrl.includes("http://") || codeOrUrl.includes("https://")) {
      const u = new URL(codeOrUrl);
      return u.searchParams.get("code");
    }
    return codeOrUrl.trim() || null;
  } catch {
    return codeOrUrl.trim() || null;
  }
}

function extractState(codeOrUrl: string): string | null {
  try {
    if (codeOrUrl.includes("http://") || codeOrUrl.includes("https://")) {
      const u = new URL(codeOrUrl);
      return u.searchParams.get("state");
    }
    return null;
  } catch {
    return null;
  }
}