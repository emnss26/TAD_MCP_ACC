import { loadSession, saveSession } from "./session.js";
import type { ApsTokenResponse } from "../aps/types.js";

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function getAccAccessToken(): Promise<string> {
  const clientId = must("APS_CLIENT_ID");
  const clientSecret = must("APS_CLIENT_SECRET");
  
  // 1. Intentar cargar sesión del archivo
  const session = loadSession();
  
  if (!session) {
    throw new Error("No hay sesión activa. Por favor pide a Claude: 'Inicia sesión en Autodesk'.");
  }

  // 2. Si el token es válido, retornarlo
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at > now + 60) {
    return session.access_token;
  }

  // 3. Si expiró, renovar automáticamente usando el Refresh Token guardado
  console.log("🔄 Renovando token caducado...");
  const url = "https://developer.api.autodesk.com/authentication/v2/token";
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", session.refresh_token);
  
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
    throw new Error("La sesión ha expirado irremediablemente. Por favor pide a Claude: 'Inicia sesión en Autodesk' nuevamente.");
  }

  const json = (await res.json()) as ApsTokenResponse;

  // 4. Guardar los nuevos tokens automáticamente
  saveSession({
    access_token: json.access_token,
    refresh_token: json.refresh_token!, // Importante: APS devuelve un nuevo refresh token
    expires_at: now + json.expires_in
  });

  return json.access_token;
}