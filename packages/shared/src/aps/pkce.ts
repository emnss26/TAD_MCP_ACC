import crypto from "node:crypto";

export function base64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function randomString(bytes = 32): string {
  return base64Url(crypto.randomBytes(bytes));
}

export function sha256Base64Url(input: string): string {
  const hash = crypto.createHash("sha256").update(input).digest();
  return base64Url(hash);
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomString(32);
  const challenge = sha256Base64Url(verifier);
  return { verifier, challenge };
}