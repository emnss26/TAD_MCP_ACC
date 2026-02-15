import { randomUUID } from "node:crypto";
import { getAccAccessToken } from "./accAuth.js";

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const MAX_ERROR_BODY_LENGTH = 800;

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export type FetchApsJsonOptions = {
  token?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
  correlationId?: string;
  serviceName?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeBody(body: string): string {
  if (!body) return "";
  if (body.length <= MAX_ERROR_BODY_LENGTH) return body;
  return `${body.slice(0, MAX_ERROR_BODY_LENGTH)}...`;
}

function parseRetryAfterSeconds(value: string | null): number | null {
  if (!value) return null;

  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return asNumber;
  }

  const asDate = Date.parse(value);
  if (!Number.isNaN(asDate)) {
    const deltaMs = asDate - Date.now();
    if (deltaMs > 0) return Math.ceil(deltaMs / 1000);
  }

  return null;
}

async function parseJsonOrText(response: Response): Promise<unknown> {
  if (response.status === 204) return {};

  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function buildHeaders(
  token: string,
  correlationId: string,
  headers: Record<string, string> = {},
  hasJsonBody = false
) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "x-correlation-id": correlationId,
    "x-request-id": correlationId,
    ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
    ...headers
  };
}

export async function fetchApsJson<T = any>(
  url: string,
  options: FetchApsJsonOptions = {}
): Promise<T> {
  const token = options.token ?? (await getAccAccessToken());
  const method = options.method ?? "GET";
  const retries = Math.max(0, options.retries ?? DEFAULT_RETRIES);
  const timeoutMs = Math.max(1000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const baseDelayMs = Math.max(100, options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS);
  const correlationId = options.correlationId ?? randomUUID();
  const serviceName = options.serviceName ?? "aps";

  const hasJsonBody =
    options.body !== undefined &&
    options.body !== null &&
    typeof options.body !== "string";

  const requestBody =
    options.body === undefined || options.body === null
      ? undefined
      : typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);

  const headers = buildHeaders(
    token,
    correlationId,
    options.headers,
    hasJsonBody
  );

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: requestBody,
        signal: controller.signal
      });

      if (response.ok) {
        clearTimeout(timer);
        return (await parseJsonOrText(response)) as T;
      }

      const errorBody = sanitizeBody(await response.text());
      const shouldRetry =
        RETRYABLE_STATUS_CODES.has(response.status) && attempt < retries;

      if (!shouldRetry) {
        clearTimeout(timer);
        throw new Error(
          `[${serviceName}] APS request failed (${response.status}) ${method} ${url} correlationId=${correlationId} body=${errorBody}`
        );
      }

      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterSeconds = parseRetryAfterSeconds(retryAfterHeader);
      const backoffMs =
        retryAfterSeconds !== null
          ? retryAfterSeconds * 1000
          : baseDelayMs * 2 ** attempt;

      clearTimeout(timer);
      await sleep(backoffMs);
    } catch (error) {
      clearTimeout(timer);

      const message =
        error instanceof Error ? error.message : "Unknown request error";
      lastError = new Error(
        `[${serviceName}] APS request error ${method} ${url} correlationId=${correlationId} attempt=${attempt + 1}/${retries + 1} message=${message}`
      );

      if (attempt >= retries) {
        throw lastError;
      }

      await sleep(baseDelayMs * 2 ** attempt);
    }
  }

  throw (
    lastError ??
    new Error(
      `[${serviceName}] APS request failed without explicit error ${method} ${url} correlationId=${correlationId}`
    )
  );
}
