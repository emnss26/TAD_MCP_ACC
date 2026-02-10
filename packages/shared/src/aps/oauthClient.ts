import { mustGetEnv } from "./env.js";

const AUTHORIZE_URL = "https://developer.api.autodesk.com/authentication/v2/authorize";
const TOKEN_URL = "https://developer.api.autodesk.com/authentication/v2/token";
const PROFILE_URL = "https://developer.api.autodesk.com/userprofile/v1/users/@me";

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const b64 = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return `Basic ${b64}`;
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  codeChallenge: string;
}): string {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("scope", params.scopes.join(" "));
  u.searchParams.set("state", params.state);

  // PKCE
  u.searchParams.set("code_challenge", params.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

export async function exchangeCodeForToken(input: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  scopes: string[];
}): Promise<TokenResponse> {
  const clientId = mustGetEnv("APS_CLIENT_ID");
  const clientSecret = mustGetEnv("APS_CLIENT_SECRET");

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", input.code);
  body.set("redirect_uri", input.redirectUri);
  body.set("code_verifier", input.codeVerifier);
  body.set("scope", input.scopes.join(" "));

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": basicAuthHeader(clientId, clientSecret)
    },
    body
  });

  if (!res.ok) throw new Error(`APS token exchange failed ${res.status}: ${await res.text()}`);
  return res.json() as Promise<TokenResponse>;
}

export async function refreshToken(input: {
  refreshToken: string;
  scopes: string[];
}): Promise<TokenResponse> {
  const clientId = mustGetEnv("APS_CLIENT_ID");
  const clientSecret = mustGetEnv("APS_CLIENT_SECRET");

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", input.refreshToken);
  body.set("scope", input.scopes.join(" "));

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": basicAuthHeader(clientId, clientSecret)
    },
    body
  });

  if (!res.ok) throw new Error(`APS refresh failed ${res.status}: ${await res.text()}`);
  return res.json() as Promise<TokenResponse>;
}

export async function fetchUserProfile(accessToken: string): Promise<{ userId?: string; email?: string; name?: string }> {
  const res = await fetch(PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) return {};
  const json = await res.json() as any;
  return {
    userId: json.userId ?? json.uid ?? json.sub,
    email: json.emailId ?? json.email,
    name: json.firstName && json.lastName ? `${json.firstName} ${json.lastName}` : json.name
  };
}