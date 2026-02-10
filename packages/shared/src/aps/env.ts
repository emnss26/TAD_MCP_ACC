export function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

export function getOptionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v?.trim() ? v.trim() : undefined;
}

export function getScopesFromEnv(defaultScopes: string[]): string[] {
  const raw = getOptionalEnv("APS_SCOPES");
  if (!raw) return defaultScopes;
  return raw
    .split(/[,\s]+/g)
    .map(s => s.trim())
    .filter(Boolean);
}