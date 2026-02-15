import type { PaginatedResponse } from "@tad/shared";
import { AccountAdminToolResponseSchema } from "../schemas/account-admin.js";

export type AccountResolutionSource =
  | "input.accountId"
  | "input.hubId"
  | "env.APS_ACCOUNT_ID"
  | "env.APS_HUB_ID";

export type AccountResolution = {
  source: AccountResolutionSource;
  rawValue: string;
  accountId: string;
};

export type AccountAdminPage = PaginatedResponse<Record<string, unknown>> & {
  schemaWarning?: string;
};

function normalizeAccountId(value: string): string {
  return value.trim().replace(/^b\./i, "");
}

export function resolveAccountId(input: {
  accountId?: string | null;
  hubId?: string | null;
}): AccountResolution {
  const byAccountInput = input.accountId?.trim();
  if (byAccountInput) {
    return {
      source: "input.accountId",
      rawValue: byAccountInput,
      accountId: normalizeAccountId(byAccountInput)
    };
  }

  const byHubInput = input.hubId?.trim();
  if (byHubInput) {
    return {
      source: "input.hubId",
      rawValue: byHubInput,
      accountId: normalizeAccountId(byHubInput)
    };
  }

  const envAccountId = process.env.APS_ACCOUNT_ID?.trim();
  if (envAccountId) {
    return {
      source: "env.APS_ACCOUNT_ID",
      rawValue: envAccountId,
      accountId: normalizeAccountId(envAccountId)
    };
  }

  const envHubId = process.env.APS_HUB_ID?.trim();
  if (envHubId) {
    return {
      source: "env.APS_HUB_ID",
      rawValue: envHubId,
      accountId: normalizeAccountId(envHubId)
    };
  }

  throw new Error(
    "Debes enviar accountId o hubId (input), o configurar APS_ACCOUNT_ID/APS_HUB_ID en entorno."
  );
}

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

export function parseAccountAdminPage(raw: unknown, input: {
  limit: number;
  offset: number;
}): AccountAdminPage {
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
    const candidates = [
      payload.results,
      payload.data,
      payload.items
    ];

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

    if ("id" in payload || "name" in payload) {
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
  const parsed = AccountAdminToolResponseSchema.safeParse(payload);
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
