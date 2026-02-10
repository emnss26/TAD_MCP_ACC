import crypto from "node:crypto";
import { getContext, setContext, clearContext } from "../config/contextStore.js";
import type { AccTokens, AccAuthStatus } from "./types.js";

const AUTH_BASE = "https://developer.api.autodesk.com/authentication/v2";
const AUTHORIZE_URL = `${AUTH_BASE}/authorize`;
const TOKEN_URL = `${AUTH_BASE}/token`;

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function basicAuthHeader(clientId: string, clientSecret: string) {
  const b64 = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
  return `Basic ${b64}`;
}

function nowMs() {
  return Date.now();
}

function isExpired(tokens: AccTokens, skewMs = 60_000) {
  const expiresAt = tokens.obtained_at + tokens.expires_in * 1000;
  return nowMs() + skewMs >= expiresAt;
}

/**
 * 1) Start login: genera URL para que el usuario haga login y te regrese el `code`.
 */
export async function startAccLogin() {
  const clientId = mustEnv("APS_CLIENT_ID");
  const redirectUri = mustEnv("APS_REDIRECT_URI");
  const scope = (process.env.APS_SCOPES || "data:read account:read").trim();

  const state = crypto.randomBytes(16).toString("hex");

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);

  await setContext({
    accAuth: {
      pendingState: state,
      scope,
      redirectUri,
    },
  });

  return {
    url: url.toString(),
    state,
    scope,
    instructions:
      "Abre el URL, autoriza, y pega aquí el parámetro `code` que regresa en el redirect.",
  };
}

/**
 * 2) Complete login: intercambia `code` por tokens y los guarda.
 */
export async function completeAccLogin(params: { code: string; state?: string }) {
  const { code, state } = params;

  const clientId = mustEnv("APS_CLIENT_ID");
  const clientSecret = mustEnv("APS_CLIENT_SECRET");
  const redirectUri = mustEnv("APS_REDIRECT_URI");

  const ctx = await getContext<any>();
  const pendingState: string | undefined = ctx?.accAuth?.pendingState;

  if (pendingState && state && pendingState !== state) {
    throw new Error("Invalid OAuth state (possible CSRF or stale login).");
  }

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", redirectUri);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`APS token exchange failed (${res.status}): ${txt}`);
  }

  const json = (await res.json()) as Omit<AccTokens, "obtained_at">;
  const tokens: AccTokens = { ...json, obtained_at: nowMs() };

  await setContext({
    accTokens: tokens,
    accAuth: {
      ...(ctx?.accAuth || {}),
      pendingState: undefined,
    },
  });

  return {
    ok: true,
    expiresAt: tokens.obtained_at + tokens.expires_in * 1000,
    scope: tokens.scope,
  };
}

/**
 * 3) Acceso seguro: refresca si expiró.
 */
export async function getAccAccessToken() {
  const clientId = mustEnv("APS_CLIENT_ID");
  const clientSecret = mustEnv("APS_CLIENT_SECRET");

  const ctx = await getContext<any>();
  const tokens: AccTokens | undefined = ctx?.accTokens;

  if (!tokens?.refresh_token) {
    throw new Error("Not authenticated. Run acc_auth_start and complete login first.");
  }

  if (!isExpired(tokens)) return tokens.access_token;

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", tokens.refresh_token);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`APS refresh failed (${res.status}): ${txt}`);
  }

  const json = (await res.json()) as Omit<AccTokens, "obtained_at">;

  // Nota: a veces refresh_token no cambia; conserva el existente si no viene
  const refreshed: AccTokens = {
    ...tokens,
    ...json,
    refresh_token: json.refresh_token || tokens.refresh_token,
    obtained_at: nowMs(),
  };

  await setContext({ accTokens: refreshed });
  return refreshed.access_token;
}

export async function getAccAuthStatus(): Promise<AccAuthStatus> {
  const ctx = await getContext<any>();
  const tokens: AccTokens | undefined = ctx?.accTokens;

  if (!tokens) {
    return { loggedIn: false, hasRefreshToken: false };
  }

  const expiresAt = tokens.obtained_at + tokens.expires_in * 1000;

  return {
    loggedIn: Boolean(tokens.refresh_token),
    hasRefreshToken: Boolean(tokens.refresh_token),
    expiresAt,
    scope: tokens.scope,
    projectId: process.env.ACC_PROJECT_ID,
  };
}

export async function logoutAcc() {
  await clearContext(["accTokens", "accAuth"]);
  return { ok: true };
}

/**
 * Aliases genéricos (por si otros paquetes se cuelgan de nombres viejos).
 */
export const beginLogin = startAccLogin;
export const completeLogin = completeAccLogin;
export const getAuthStatus = getAccAuthStatus;
export const logout = logoutAcc;
export const ensureAccessToken = getAccAccessToken;