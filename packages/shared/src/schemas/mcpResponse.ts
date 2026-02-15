import { z } from "zod";

const NumericLike = z.union([z.number(), z.string()]);

export const McpWarningSchema = z
  .object({
    code: z.string().optional(),
    message: z.string(),
    source: z.string().optional(),
    details: z.unknown().optional()
  })
  .passthrough();

export const McpPaginationSchema = z
  .object({
    limit: NumericLike.optional(),
    offset: NumericLike.optional(),
    totalResults: NumericLike.optional(),
    returned: NumericLike.optional(),
    hasMore: z.boolean().optional(),
    nextOffset: z.union([z.number(), z.null()]).optional(),
    fetchAll: z.boolean().optional(),
    maxPages: z.number().optional(),
    maxItems: z.number().optional(),
    fetchedPages: z.number().optional(),
    fetchedItems: z.number().optional(),
    pageSize: NumericLike.optional(),
    cursor: z.string().optional()
  })
  .passthrough();

export const McpMetaSchema = z
  .object({
    tool: z.string().optional(),
    generatedAt: z.string().optional(),
    source: z.string().optional(),
    request: z.record(z.string(), z.unknown()).optional()
  })
  .passthrough();

export function createMcpResponseSchema<TResult extends z.ZodTypeAny>(
  resultSchema: TResult
) {
  return z
    .object({
      results: z.array(resultSchema).default([]),
      pagination: McpPaginationSchema.optional(),
      meta: McpMetaSchema.optional(),
      warnings: z.array(McpWarningSchema).default([])
    })
    .passthrough();
}

export type McpWarning = z.infer<typeof McpWarningSchema>;

export type McpResponse<TResult = unknown> = {
  results: TResult[];
  pagination?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  warnings: McpWarning[];
  [key: string]: unknown;
};

type JsonObject = Record<string, unknown>;

function normalizeWarning(warning: string | McpWarning): McpWarning {
  if (typeof warning === "string") {
    return { message: warning };
  }
  return warning;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isObjectArray(value: unknown): value is JsonObject[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => isJsonObject(item))
  );
}

function objectArrayToTable(items: JsonObject[]) {
  const cols: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    for (const key of Object.keys(item)) {
      if (!seen.has(key)) {
        seen.add(key);
        cols.push(key);
      }
    }
  }

  const rows = items.map((item) => cols.map((col) => item[col] ?? null));
  return { cols, rows };
}

function compactTopLevelPayload(payload: unknown): unknown {
  if (isObjectArray(payload)) {
    const table = objectArrayToTable(payload);
    return { cols: table.cols, rows: table.rows, totalResults: payload.length };
  }

  if (!isJsonObject(payload)) {
    return payload;
  }

  const results = payload.results;
  if (!isObjectArray(results)) {
    return payload;
  }

  const hasPagination = isJsonObject(payload.pagination);
  const shouldCompact = hasPagination || results.length > 25;
  if (!shouldCompact) {
    return payload;
  }

  const table = objectArrayToTable(results);
  return {
    ...payload,
    results: [],
    cols: table.cols,
    rows: table.rows
  };
}

export function stringifyMcpPayload(payload: unknown): string {
  return JSON.stringify(compactTopLevelPayload(payload));
}

export function buildMcpResponse<TResult = unknown>(input: {
  results?: TResult[];
  pagination?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  warnings?: Array<string | McpWarning>;
} = {}): McpResponse<TResult> {
  return {
    results: Array.isArray(input.results) ? input.results : [],
    ...(input.pagination ? { pagination: input.pagination } : {}),
    ...(input.meta ? { meta: input.meta } : {}),
    warnings: (input.warnings ?? []).map(normalizeWarning)
  };
}
