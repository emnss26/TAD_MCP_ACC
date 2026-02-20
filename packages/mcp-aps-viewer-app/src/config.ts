import "dotenv/config";

function parsePort(value: string | undefined): number {
  const parsed = Number(value ?? "3100");
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 3100;
  }
  return Math.trunc(parsed);
}

export const PORT = parsePort(process.env.PORT);

export const PUBLIC_ENDPOINT_URL = process.env.PUBLIC_ENDPOINT_URL?.trim() || null;

const allowedHostsFromEnv = process.env.ALLOWED_HOSTS?.trim();
export const ALLOWED_HOSTS = allowedHostsFromEnv
  ? allowedHostsFromEnv.split(",").map((value) => value.trim()).filter(Boolean)
  : [];
