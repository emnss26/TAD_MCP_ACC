import fs from "node:fs";
import path from "node:path";
import os from "node:os";

type Context = Record<string, unknown>;

const defaultDir = path.join(os.homedir(), ".tad-mcp");
const defaultPath = path.join(defaultDir, "context.json");

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath: string): Context {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, "utf-8");
    return raw.trim() ? (JSON.parse(raw) as Context) : {};
  } catch {
    return {};
  }
}

function writeJson(filePath: string, data: Context) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function getStorePath() {
  return process.env.TAD_CONTEXT_PATH?.trim() || defaultPath;
}

export function getContext(): Context {
  return readJson(getStorePath());
}

export function setContext(patch: Context): Context {
  const filePath = getStorePath();
  const current = readJson(filePath);
  const next = { ...current, ...patch };
  writeJson(filePath, next);
  return next;
}