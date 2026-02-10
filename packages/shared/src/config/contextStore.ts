import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

type ContextShape = Record<string, unknown>;

const DEFAULT_DIR = path.join(os.homedir(), ".tad-mcp-acc");
const DEFAULT_FILE = path.join(DEFAULT_DIR, "context.json");

function getStorePath() {
  return process.env.TAD_CONTEXT_PATH || DEFAULT_FILE;
}

async function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

export async function getContext<T = ContextShape>(): Promise<T> {
  const filePath = getStorePath();
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}

export async function setContext(patch: Partial<ContextShape>) {
  const filePath = getStorePath();
  await ensureDir(filePath);

  const current = await getContext<ContextShape>();
  const next = { ...current, ...patch };

  await fs.writeFile(filePath, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function clearContext(keys?: string[]) {
  const filePath = getStorePath();
  const current = await getContext<ContextShape>();

  const next =
    !keys || keys.length === 0
      ? {}
      : Object.fromEntries(Object.entries(current).filter(([k]) => !keys.includes(k)));

  await ensureDir(filePath);
  await fs.writeFile(filePath, JSON.stringify(next, null, 2), "utf8");
  return next;
}