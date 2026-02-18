import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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

export const ListViewSchema = z.enum(["summary", "page", "full"]);
export type ListView = z.infer<typeof ListViewSchema>;

export const DEFAULT_LIST_LIMIT = 10;
export const MAX_LIST_LIMIT = 50;

const HANDLE_TTL_MS = 1000 * 60 * 30;
const HANDLE_MAX_ENTRIES = 500;
const FULL_VIEW_MAX_ROWS = 200;

type JsonObject = Record<string, unknown>;

type StoredResultHandle = {
  handle: string;
  rows: JsonObject[];
  source?: string;
  createdAt: string;
  expiresAt: number;
};

const handleStore = new Map<string, StoredResultHandle>();

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

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toNonNegativeInteger(value: unknown): number | null {
  const parsed = toNumber(value);
  if (parsed === null) {
    return null;
  }

  const normalized = Math.trunc(parsed);
  return normalized >= 0 ? normalized : null;
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      output.push(value);
    }
  }

  return output;
}

function normalizeFields(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const fields = dedupeStrings(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0)
    );
    return fields.length > 0 ? fields : null;
  }

  if (typeof value === "string") {
    const fields = dedupeStrings(
      value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    );
    return fields.length > 0 ? fields : null;
  }

  return null;
}

function normalizeView(value: unknown): ListView {
  if (value === "summary" || value === "full") {
    return value;
  }
  return "page";
}

export function clampListLimit(value: unknown, fallback = DEFAULT_LIST_LIMIT): number {
  const parsed = toNumber(value);
  if (parsed === null) {
    return fallback;
  }

  return Math.max(1, Math.min(MAX_LIST_LIMIT, Math.trunc(parsed)));
}

export function parseOffsetCursor(cursor: unknown): number | null {
  if (typeof cursor === "number") {
    return toNonNegativeInteger(cursor);
  }

  if (typeof cursor !== "string") {
    return null;
  }

  const trimmed = cursor.trim();
  if (!trimmed) {
    return null;
  }

  const offsetMatch = /^offset:(\d+)$/i.exec(trimmed);
  if (offsetMatch) {
    return Number(offsetMatch[1]);
  }

  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return Math.trunc(asNumber);
  }

  return null;
}

export function encodeOffsetCursor(offset: number | null | undefined): string | null {
  if (typeof offset !== "number" || !Number.isFinite(offset) || offset < 0) {
    return null;
  }

  return `offset:${Math.trunc(offset)}`;
}

function compactMeta(meta: unknown): JsonObject | undefined {
  if (!isJsonObject(meta)) {
    return undefined;
  }

  const compact: JsonObject = {};
  const copyKey = (key: string) => {
    if (key in meta) {
      compact[key] = meta[key];
    }
  };

  copyKey("tool");
  copyKey("generatedAt");
  copyKey("source");
  copyKey("projectResolution");
  copyKey("accountResolution");
  copyKey("hubId");
  copyKey("projectId");
  copyKey("folderId");
  copyKey("itemId");

  if (isJsonObject(meta.options)) {
    const options = meta.options;
    const compactOptions: JsonObject = {};
    for (const key of ["view", "limit", "cursor", "outputFields"]) {
      if (key in options) {
        compactOptions[key] = options[key];
      }
    }

    if (Object.keys(compactOptions).length > 0) {
      compact.options = compactOptions;
    }
  }

  return Object.keys(compact).length > 0 ? compact : undefined;
}

function normalizeWarnings(value: unknown): Array<string | JsonObject> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (isJsonObject(item)) {
        return item;
      }

      return null;
    })
    .filter((item): item is string | JsonObject => item !== null);
}

function objectArrayToTable(items: JsonObject[], requestedFields?: string[] | null) {
  const cols = requestedFields && requestedFields.length > 0
    ? requestedFields
    : dedupeStrings(items.flatMap((item) => Object.keys(item)));

  const rows = items.map((item) => cols.map((col) => item[col] ?? null));
  return { cols, rows };
}

function cleanupHandleStore() {
  const now = Date.now();

  for (const [handle, record] of handleStore.entries()) {
    if (record.expiresAt <= now) {
      handleStore.delete(handle);
    }
  }

  if (handleStore.size <= HANDLE_MAX_ENTRIES) {
    return;
  }

  const entries = [...handleStore.entries()].sort((a, b) =>
    a[1].createdAt.localeCompare(b[1].createdAt)
  );

  while (entries.length > 0 && handleStore.size > HANDLE_MAX_ENTRIES) {
    const [handle] = entries.shift()!;
    handleStore.delete(handle);
  }
}

export function createResultHandle(rows: JsonObject[], source?: string): string | null {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  cleanupHandleStore();
  const handle = `result:${randomUUID()}`;
  const now = Date.now();

  handleStore.set(handle, {
    handle,
    rows,
    source,
    createdAt: new Date(now).toISOString(),
    expiresAt: now + HANDLE_TTL_MS
  });

  return handle;
}

function getResultHandleInternal(handle: string): StoredResultHandle | null {
  cleanupHandleStore();
  const record = handleStore.get(handle);
  if (!record) {
    return null;
  }

  if (record.expiresAt <= Date.now()) {
    handleStore.delete(handle);
    return null;
  }

  return record;
}

function resolveRequestedFields(payload: JsonObject): string[] | null {
  const topLevel = normalizeFields(payload.fields);
  if (topLevel) {
    return topLevel;
  }

  if (!isJsonObject(payload.meta) || !isJsonObject(payload.meta.options)) {
    return null;
  }

  const options = payload.meta.options;
  return (
    normalizeFields(options.outputFields) ??
    normalizeFields(options.fields) ??
    null
  );
}

function resolveView(payload: JsonObject): ListView {
  const topLevel = normalizeView(payload.view);

  if (!isJsonObject(payload.meta) || !isJsonObject(payload.meta.options)) {
    return topLevel;
  }

  const options = payload.meta.options;
  return normalizeView(options.view ?? topLevel);
}

function resolveLimit(payload: JsonObject): number {
  if (isJsonObject(payload.meta) && isJsonObject(payload.meta.options)) {
    const options = payload.meta.options;
    if ("limit" in options) {
      return clampListLimit(options.limit);
    }
  }

  if (isJsonObject(payload.pagination) && "limit" in payload.pagination) {
    return clampListLimit(payload.pagination.limit);
  }

  return DEFAULT_LIST_LIMIT;
}

function resolveOffset(payload: JsonObject): number {
  if (isJsonObject(payload.meta) && isJsonObject(payload.meta.options)) {
    const options = payload.meta.options;
    const fromCursor = parseOffsetCursor(options.cursor);
    if (fromCursor !== null) {
      return fromCursor;
    }

    const fromOffset = toNonNegativeInteger(options.offset);
    if (fromOffset !== null) {
      return fromOffset;
    }
  }

  if (isJsonObject(payload.pagination)) {
    const fromCursor = parseOffsetCursor(payload.pagination.cursor);
    if (fromCursor !== null) {
      return fromCursor;
    }

    const fromOffset = toNonNegativeInteger(payload.pagination.offset);
    if (fromOffset !== null) {
      return fromOffset;
    }
  }

  return 0;
}

function buildSummary(input: {
  rows: JsonObject[];
  totalResults?: unknown;
  offset: number;
  limit: number;
  returned: number;
  hasMore: boolean;
}): JsonObject {
  const totalResults = toNonNegativeInteger(input.totalResults) ?? input.rows.length;
  const byStatus: Record<string, number> = {};

  for (const row of input.rows) {
    const status = typeof row.status === "string" ? row.status.trim() : "";
    if (status) {
      byStatus[status] = (byStatus[status] ?? 0) + 1;
    }
  }

  return {
    totalResults,
    offset: input.offset,
    limit: input.limit,
    returned: input.returned,
    hasMore: input.hasMore,
    ...(Object.keys(byStatus).length > 0 ? { byStatus } : {})
  };
}

function formatListRowsPayload(payload: {
  allRows: JsonObject[];
  view: ListView;
  limit: number;
  offset: number;
  nextOffset: number | null;
  hasMore: boolean;
  totalResults?: unknown;
  fields?: string[] | null;
  source?: string;
  warnings?: unknown;
  meta?: unknown;
}): JsonObject {
  const warnings = normalizeWarnings(payload.warnings);
  const outWarnings = [...warnings];

  const handle = createResultHandle(payload.allRows, payload.source);

  const maxRows = payload.view === "full" ? FULL_VIEW_MAX_ROWS : payload.limit;
  const rowsForView =
    payload.view === "summary"
      ? []
      : payload.allRows.slice(0, maxRows);

  if (payload.view === "full" && payload.allRows.length > FULL_VIEW_MAX_ROWS) {
    outWarnings.push({
      code: "full_view_truncated",
      message: `La vista full esta limitada a ${FULL_VIEW_MAX_ROWS} filas. Usa mcp_result_export para extraer todo.`,
      source: "list_contract"
    });
  }

  const table = objectArrayToTable(rowsForView, payload.fields);

  const localHasMore = payload.allRows.length > rowsForView.length;
  const localNextOffset = localHasMore ? payload.offset + rowsForView.length : null;
  const nextCursor = encodeOffsetCursor(
    payload.nextOffset ?? localNextOffset
  );

  const summary = buildSummary({
    rows: payload.allRows,
    totalResults: payload.totalResults,
    offset: payload.offset,
    limit: payload.limit,
    returned: rowsForView.length,
    hasMore: payload.hasMore || localHasMore
  });
  const compactedMeta = compactMeta(payload.meta);

  return {
    summary,
    ...(payload.view === "summary" ? {} : { cols: table.cols, rows: table.rows }),
    nextCursor,
    ...(handle ? { handle } : {}),
    ...(outWarnings.length > 0 ? { warnings: outWarnings } : {}),
    ...(compactedMeta ? { meta: compactedMeta } : {})
  };
}

function compactTopLevelPayload(payload: unknown): unknown {
  if (isObjectArray(payload)) {
    return formatListRowsPayload({
      allRows: payload,
      view: "page",
      limit: DEFAULT_LIST_LIMIT,
      offset: 0,
      nextOffset: payload.length > DEFAULT_LIST_LIMIT ? DEFAULT_LIST_LIMIT : null,
      hasMore: payload.length > DEFAULT_LIST_LIMIT,
      totalResults: payload.length,
      fields: null
    });
  }

  if (!isJsonObject(payload)) {
    return payload;
  }

  if (Array.isArray(payload.rows) && Array.isArray(payload.cols) && isJsonObject(payload.summary)) {
    return payload;
  }

  if (!isObjectArray(payload.results)) {
    return payload;
  }

  const hasPagination = isJsonObject(payload.pagination);
  const hasExplicitView =
    isJsonObject(payload.meta) &&
    isJsonObject(payload.meta.options) &&
    "view" in payload.meta.options;

  if (!hasPagination && !hasExplicitView && payload.results.length <= MAX_LIST_LIMIT) {
    return payload;
  }

  const rows = payload.results;
  const pagination = isJsonObject(payload.pagination) ? payload.pagination : {};
  const view = resolveView(payload);
  const limit = resolveLimit(payload);
  const offset = resolveOffset(payload);
  const nextOffset = toNonNegativeInteger(pagination.nextOffset);
  const hasMore = Boolean(pagination.hasMore);
  const totalResults = pagination.totalResults;
  const fields = resolveRequestedFields(payload);
  const source = isJsonObject(payload.meta) && typeof payload.meta.source === "string"
    ? payload.meta.source
    : undefined;

  return formatListRowsPayload({
    allRows: rows,
    view,
    limit,
    offset,
    nextOffset,
    hasMore,
    totalResults,
    fields,
    source,
    warnings: payload.warnings,
    meta: payload.meta
  });
}

export function stringifyMcpPayload(payload: unknown): string {
  return JSON.stringify(compactTopLevelPayload(payload));
}

export function getResultHandlePage(input: {
  handle: string;
  cursor?: string;
  limit?: number;
  view?: ListView;
  fields?: string[];
}) {
  const record = getResultHandleInternal(input.handle);
  if (!record) {
    throw new Error("Handle no encontrado o expirado.");
  }

  const offset = parseOffsetCursor(input.cursor) ?? 0;
  const limit = clampListLimit(input.limit);
  const view = normalizeView(input.view);
  const fields = normalizeFields(input.fields) ?? null;

  const rows = record.rows.slice(offset);
  const pageRows =
    view === "summary"
      ? []
      : view === "full"
        ? rows
        : rows.slice(0, limit);

  const table = objectArrayToTable(pageRows, fields);
  const nextOffset =
    view === "summary"
      ? offset < record.rows.length
        ? offset + limit
        : null
      : offset + pageRows.length < record.rows.length
        ? offset + pageRows.length
        : null;

  return {
    summary: buildSummary({
      rows: record.rows,
      totalResults: record.rows.length,
      offset,
      limit,
      returned: pageRows.length,
      hasMore: nextOffset !== null
    }),
    ...(view === "summary" ? {} : { cols: table.cols, rows: table.rows }),
    nextCursor: encodeOffsetCursor(nextOffset),
    handle: input.handle,
    meta: {
      source: record.source,
      createdAt: record.createdAt
    }
  };
}

export function getResultHandleItem(input: {
  handle: string;
  id: string;
  idField?: string;
  fields?: string[];
}) {
  const record = getResultHandleInternal(input.handle);
  if (!record) {
    throw new Error("Handle no encontrado o expirado.");
  }

  const lookupFields = dedupeStrings(
    [input.idField, "id", "urn", "guid", "_id"]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim())
  );

  const row = record.rows.find((candidate) =>
    lookupFields.some((field) => {
      const value = candidate[field];
      return typeof value === "string" && value === input.id;
    })
  );

  if (!row) {
    return {
      found: false,
      handle: input.handle,
      id: input.id
    };
  }

  const requestedFields = normalizeFields(input.fields);
  const item = requestedFields
    ? Object.fromEntries(requestedFields.map((field) => [field, row[field] ?? null]))
    : row;

  return {
    found: true,
    handle: input.handle,
    id: input.id,
    item
  };
}

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const asString =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value);

  if (/[",\n\r]/.test(asString)) {
    return `"${asString.replace(/"/g, '""')}"`;
  }

  return asString;
}

export async function exportResultHandle(input: {
  handle: string;
  format: "csv" | "jsonl";
  filePath?: string;
  fields?: string[];
}) {
  const record = getResultHandleInternal(input.handle);
  if (!record) {
    throw new Error("Handle no encontrado o expirado.");
  }

  const requestedFields = normalizeFields(input.fields);
  const cols = requestedFields ?? dedupeStrings(record.rows.flatMap((row) => Object.keys(row)));

  const outputPath = input.filePath
    ? path.resolve(input.filePath)
    : path.join(tmpdir(), `${input.handle.replace(/[:]/g, "_")}.${input.format}`);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  if (input.format === "jsonl") {
    const lines = record.rows.map((row) =>
      JSON.stringify(
        requestedFields
          ? Object.fromEntries(cols.map((col) => [col, row[col] ?? null]))
          : row
      )
    );

    await fs.writeFile(outputPath, lines.join("\n"), "utf8");
  } else {
    const header = cols.map(toCsvValue).join(",");
    const lines = record.rows.map((row) =>
      cols.map((col) => toCsvValue(row[col] ?? null)).join(",")
    );
    await fs.writeFile(outputPath, [header, ...lines].join("\n"), "utf8");
  }

  return {
    ok: true,
    handle: input.handle,
    format: input.format,
    file: outputPath,
    count: record.rows.length
  };
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
