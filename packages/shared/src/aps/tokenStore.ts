import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export type StoredTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  obtained_at: number; // epoch ms
  profile?: {
    userId?: string;
    email?: string;
    name?: string;
  };
};

type StoreFile = {
  version: 1;
  tokens?: StoredTokens;
};

function storePath(): string {
  const dir = path.join(os.homedir(), ".tad-mcp-acc");
  return path.join(dir, "tokens.json");
}

async function ensureDir(): Promise<void> {
  const p = storePath();
  await fs.mkdir(path.dirname(p), { recursive: true });
}

export async function readTokens(): Promise<StoredTokens | undefined> {
  try {
    const raw = await fs.readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    return parsed.tokens;
  } catch {
    return undefined;
  }
}

export async function writeTokens(tokens: StoredTokens): Promise<void> {
  await ensureDir();
  const payload: StoreFile = { version: 1, tokens };
  const p = storePath();
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(payload, null, 2), "utf8");
  await fs.rename(tmp, p);
}

export async function clearTokens(): Promise<void> {
  try {
    await fs.unlink(storePath());
  } catch {
    // ignore
  }
}