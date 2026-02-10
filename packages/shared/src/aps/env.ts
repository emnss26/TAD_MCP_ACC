export function mustGetEnv(key: string): string {
  const v = process.env[key];
  if (!v || !v.trim()) throw new Error(`Missing env var: ${key}`);
  return v.trim();
}

// Unificamos: el repo usa APS_CALLBACK_URL.
// Si existe APS_REDIRECT_URI, lo aceptamos por compatibilidad.
export function getCallbackUrl(): string {
  const v = process.env.APS_CALLBACK_URL?.trim() || process.env.APS_REDIRECT_URI?.trim();
  if (!v) throw new Error("Missing env var: APS_CALLBACK_URL");
  return v;
}

export function getScopesFromEnv(fallback: string[]): string[] {
  const raw = process.env.APS_SCOPES?.replace(/['"]/g, "").trim();
  if (!raw) return fallback;
  return raw.split(/\s+/).filter(Boolean);
}