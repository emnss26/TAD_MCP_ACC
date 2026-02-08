import type { ApsTokenResponse } from "../aps/types.js";

let cached: { token: string; exp: number } | null = null;

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function getAccAccessToken(): Promise<string> {
  // Cache simple (evita pedir token en cada tool call)
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;

  const clientId = must("APS_CLIENT_ID");
  const clientSecret = must("APS_CLIENT_SECRET");
  const refreshToken = must("APS_REFRESH_TOKEN");
  const scope = process.env.APS_SCOPE ?? "data:read data:write account:read";

  const url = "https://developer.api.autodesk.com/authentication/v2/token";

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);
  body.set("scope", scope);

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`APS token error ${res.status}: ${t}`);
  }

  const json = (await res.json()) as ApsTokenResponse;

  cached = { token: json.access_token, exp: now + json.expires_in };
  return json.access_token;
}