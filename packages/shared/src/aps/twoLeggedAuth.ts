import { mustGetEnv } from "./env.js";

const TOKEN_URL = "https://developer.api.autodesk.com/authentication/v2/token";
const DEFAULT_SCOPES = ["viewables:read", "data:read"];
const EXP_SKEW_SECONDS = 60;

type CachedTwoLeggedToken = {
  accessToken: string;
  expiresAtMs: number;
  scopesKey: string;
};

let cached: CachedTwoLeggedToken | null = null;

function normalizeScopes(input?: string[]): string[] {
  if (Array.isArray(input) && input.length > 0) {
    const scopes = input
      .map((scope) => scope.trim())
      .filter(Boolean);
    return scopes.length > 0 ? scopes : DEFAULT_SCOPES;
  }

  const raw = process.env.APS_TWO_LEGGED_SCOPES?.replace(/['"]/g, "").trim();
  if (!raw) {
    return DEFAULT_SCOPES;
  }

  const scopes = raw
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  return scopes.length > 0 ? scopes : DEFAULT_SCOPES;
}

function scopesToKey(scopes: string[]): string {
  return [...new Set(scopes)].sort().join(" ");
}

function isCacheValid(entry: CachedTwoLeggedToken, nowMs: number): boolean {
  return nowMs < entry.expiresAtMs - EXP_SKEW_SECONDS * 1000;
}

export function clearApsTwoLeggedTokenCache(): void {
  cached = null;
}

export async function getApsTwoLeggedToken(input?: {
  scopes?: string[];
  forceRefresh?: boolean;
}): Promise<string> {
  const scopes = normalizeScopes(input?.scopes);
  const scope = scopesToKey(scopes);
  const now = Date.now();

  if (!input?.forceRefresh && cached && cached.scopesKey === scope && isCacheValid(cached, now)) {
    return cached.accessToken;
  }

  const clientId = mustGetEnv("APS_CLIENT_ID");
  const clientSecret = mustGetEnv("APS_CLIENT_SECRET");
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("scope", scope);

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`APS two-legged token failed ${response.status}: ${detail}`);
  }

  const payload = (await response.json()) as {
    access_token?: unknown;
    expires_in?: unknown;
  };

  if (typeof payload.access_token !== "string" || !payload.access_token.trim()) {
    throw new Error("APS two-legged token response missing access_token.");
  }

  const expiresInSeconds =
    typeof payload.expires_in === "number"
      ? payload.expires_in
      : Number.parseInt(String(payload.expires_in ?? ""), 10);

  const ttlSeconds = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
    ? expiresInSeconds
    : 3599;

  cached = {
    accessToken: payload.access_token,
    expiresAtMs: now + ttlSeconds * 1000,
    scopesKey: scope
  };

  return payload.access_token;
}
