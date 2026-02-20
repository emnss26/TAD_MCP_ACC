import type { PaginatedResponse } from "@tad/shared";
import { SheetsToolResponseSchema } from "../schemas/sheets.js";

export type SheetsPage = PaginatedResponse<Record<string, unknown>> & {
  schemaWarning?: string;
};

function buildFallbackPagination(limit: number, offset: number, returned: number) {
  const hasMore = returned >= limit;
  return {
    limit,
    offset,
    totalResults: returned,
    returned,
    hasMore,
    nextOffset: hasMore ? offset + returned : null
  };
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as Array<
    Record<string, unknown>
  >;
}

export function parseSheetsPage(raw: unknown, input: {
  limit: number;
  offset: number;
}): SheetsPage {
  const fallback = buildFallbackPagination(input.limit, input.offset, 0);

  if (Array.isArray(raw)) {
    const results = toRecordArray(raw);
    return {
      results,
      pagination: buildFallbackPagination(input.limit, input.offset, results.length)
    };
  }

  if (raw && typeof raw === "object") {
    const payload = raw as Record<string, unknown>;
    const candidates = [payload.results, payload.data, payload.items];

    const results = candidates
      .map((candidate) => toRecordArray(candidate))
      .find((candidate) => candidate.length > 0);

    if (results) {
      const pagination =
        payload.pagination && typeof payload.pagination === "object"
          ? (payload.pagination as Record<string, unknown>)
          : buildFallbackPagination(input.limit, input.offset, results.length);

      return {
        ...payload,
        results,
        pagination
      };
    }

    if ("id" in payload || "name" in payload || "title" in payload) {
      return {
        results: [payload],
        pagination: buildFallbackPagination(input.limit, input.offset, 1)
      };
    }

    return {
      ...payload,
      results: [],
      pagination: fallback,
      schemaWarning:
        "La respuesta no contiene results/data/items en formato de arreglo."
    };
  }

  return {
    results: [],
    pagination: fallback,
    schemaWarning: "La respuesta no tiene un formato JSON valido."
  };
}

export function finalizePayload(
  toolName: string,
  payload: Record<string, unknown>
) {
  const parsed = SheetsToolResponseSchema.safeParse(payload);
  if (parsed.success) {
    return parsed.data;
  }

  const currentWarnings = Array.isArray(payload.warnings)
    ? (payload.warnings as Array<Record<string, unknown>>)
    : [];

  return {
    ...payload,
    warnings: [
      ...currentWarnings,
      {
        code: "schema_warning",
        message: `La respuesta final de ${toolName} incluye campos/formatos fuera del schema esperado.`,
        source: toolName
      }
    ]
  };
}
