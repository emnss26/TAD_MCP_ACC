import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAccAccessToken,
  fetchAllPages,
  resolveProject,
  normalizeProjectIdForConstruction,
  buildMcpResponse,
  parseOffsetCursor,
  type PaginatedResponse,
  type ResolveProjectResult,
  stringifyMcpPayload
} from "@tad/shared";
import { listRfis, getRfiTypes, getRfiAttributes } from "../acc/rfis.client.js";
import { getProjectUsers, getProjectCompanies } from "../acc/admin.client.js";
import { RfisPaginationSchema } from "../schemas/pagination.js";
import { RfiListResponseSchema, RfiToolResponseSchema } from "../schemas/rfis.js";

type RfiResult = Record<string, unknown>;

type RfiListPage = PaginatedResponse<RfiResult> & {
  schemaWarning?: string;
};

type ProjectResolution = Omit<ResolveProjectResult, "projectId"> & {
  rfisProjectId: string;
};

const Input = z.object({
  hubId: z
    .string()
    .optional()
    .describe("Hub ID para resolver projectName. Si se omite, usa APS_HUB_ID."),
  projectId: z
    .string()
    .min(3)
    .optional()
    .describe("Project ID directo (con o sin prefijo b.)."),
  projectName: z
    .string()
    .min(2)
    .optional()
    .describe("Nombre del proyecto para resolver el projectId usando el hub."),
  includeContext: z
    .boolean()
    .default(false)
    .describe("Incluye usuarios, companias, tipos de RFI y atributos."),
  includeDictionaries: z
    .boolean()
    .default(false)
    .describe("Incluye diccionarios por ID para facilitar el mapeo."),
  ...RfisPaginationSchema
});

type InputArgs = z.infer<typeof Input>;

function parseRfiPage(raw: unknown): RfiListPage {
  const parsed = RfiListResponseSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data as RfiListPage;
  }

  if (raw && typeof raw === "object") {
    return {
      ...(raw as RfiListPage),
      schemaWarning: "La respuesta de RFIs incluye campos/formatos fuera del schema esperado."
    };
  }

  return {
    results: [],
    schemaWarning: "La respuesta de RFIs no tiene un formato JSON valido."
  };
}

function getResultsArray(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload as Record<string, unknown>[];
  }
  if (payload && typeof payload === "object" && Array.isArray((payload as any).results)) {
    return (payload as any).results;
  }
  return [];
}

function buildIdentityMap(items: Record<string, unknown>[], idKeys: string[]) {
  const map: Record<string, Record<string, unknown>> = {};
  for (const item of items) {
    const id = idKeys
      .map((key) => item[key])
      .find((value) => typeof value === "string" && value.trim().length > 0);
    if (typeof id === "string") {
      map[id] = item;
    }
  }
  return map;
}

function resolveIdentity(
  id: unknown,
  usersById: Record<string, Record<string, unknown>>,
  companiesById: Record<string, Record<string, unknown>>
) {
  if (typeof id !== "string" || !id.trim()) return null;
  return usersById[id] ?? companiesById[id] ?? { id, unresolved: true };
}

function enrichRfiResult(
  rfi: RfiResult,
  usersById: Record<string, Record<string, unknown>>,
  companiesById: Record<string, Record<string, unknown>>
) {
  const idFields = [
    "assignedTo",
    "managerId",
    "constructionManagerId",
    "architectId",
    "reviewerId",
    "respondedBy",
    "createdBy",
    "updatedBy",
    "closedBy",
    "answeredBy"
  ] as const;

  const resolvedActors: Record<string, unknown> = {};
  for (const field of idFields) {
    if (field in rfi) {
      resolvedActors[field] = resolveIdentity(rfi[field], usersById, companiesById);
    }
  }

  const resolveArray = (value: unknown) =>
    Array.isArray(value)
      ? value.map((id) => resolveIdentity(id, usersById, companiesById))
      : [];

  return {
    ...rfi,
    resolvedActors,
    resolvedDistributionList: resolveArray(rfi.distributionList),
    resolvedCoReviewers: resolveArray(rfi.coReviewers)
  };
}

async function fetchContext(
  token: string,
  projectId: string,
  enabled: boolean
): Promise<{
  context?: Record<string, unknown>;
  dictionaries?: Record<string, unknown>;
  warnings: string[];
  usersById: Record<string, Record<string, unknown>>;
  companiesById: Record<string, Record<string, unknown>>;
}> {
  if (!enabled) {
    return {
      warnings: [],
      usersById: {},
      companiesById: {}
    };
  }

  const warnings: string[] = [];
  const [usersRes, companiesRes, typesRes, attrsRes] = await Promise.allSettled([
    getProjectUsers(projectId),
    getProjectCompanies(projectId),
    getRfiTypes({ token, projectId }),
    getRfiAttributes({ token, projectId })
  ]);

  const users = usersRes.status === "fulfilled" ? getResultsArray(usersRes.value) : [];
  const companies = companiesRes.status === "fulfilled" ? getResultsArray(companiesRes.value) : [];
  const rfiTypes = typesRes.status === "fulfilled" ? getResultsArray(typesRes.value) : [];
  const attributes = attrsRes.status === "fulfilled" ? getResultsArray(attrsRes.value) : [];

  if (usersRes.status === "rejected") {
    warnings.push(`No se pudieron obtener usuarios: ${String(usersRes.reason)}`);
  }
  if (companiesRes.status === "rejected") {
    warnings.push(`No se pudieron obtener companias: ${String(companiesRes.reason)}`);
  }
  if (typesRes.status === "rejected") {
    warnings.push(`No se pudieron obtener tipos de RFI: ${String(typesRes.reason)}`);
  }
  if (attrsRes.status === "rejected") {
    warnings.push(`No se pudieron obtener atributos de RFI: ${String(attrsRes.reason)}`);
  }

  const usersById = buildIdentityMap(users, ["autodeskId", "id"]);
  const companiesById = buildIdentityMap(companies, ["id"]);
  const rfiTypesById = buildIdentityMap(rfiTypes, ["id"]);

  return {
    context: {
      users,
      companies,
      rfiTypes,
      attributes
    },
    dictionaries: {
      usersById,
      companiesById,
      rfiTypesById
    },
    warnings,
    usersById,
    companiesById
  };
}

function finalizePayload(payload: Record<string, unknown>) {
  const parsed = RfiToolResponseSchema.safeParse(payload);
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
        message: "La respuesta final de acc_rfis_list incluye campos/formatos fuera del schema esperado.",
        source: "acc_rfis_list"
      }
    ]
  };
}

export function registerAccRfisList(server: McpServer) {
  server.registerTool(
    "acc_rfis_list",
    {
      title: "ACC RFIs - List",
      description:
        "Lista RFIs de ACC. Puede resolver projectId desde projectName + hubId y anade contexto.",
      inputSchema: Input.shape
    },
    async (args: InputArgs) => {
      const token = await getAccAccessToken();
      const offset = parseOffsetCursor(args.cursor) ?? args.offset;
      const fetchAll = args.view === "full" ? args.fetchAll : false;

      const resolvedProject = await resolveProject({
        projectId: args.projectId,
        projectName: args.projectName,
        hubId: args.hubId,
        envHubId: process.env.APS_HUB_ID,
        normalizeProjectId: normalizeProjectIdForConstruction
      });

      const project: ProjectResolution = {
        source: resolvedProject.source,
        hubId: resolvedProject.hubId,
        requestedProjectName: resolvedProject.requestedProjectName,
        resolvedProjectName: resolvedProject.resolvedProjectName,
        rawProjectId: resolvedProject.rawProjectId,
        rfisProjectId: resolvedProject.projectId
      };

      const page = await fetchAllPages<RfiListPage, RfiResult>({
        fetchAll,
        limit: args.limit,
        offset,
        maxPages: args.maxPages,
        maxItems: args.maxItems,
        fetchPage: async ({ limit, offset }) =>
          parseRfiPage(
            await listRfis({
              token,
              projectId: project.rfisProjectId,
              limit,
              offset
            })
          )
      });

      const context = await fetchContext(token, project.rfisProjectId, args.includeContext);

      const rawResults = Array.isArray(page.results) ? page.results : [];
      const enrichedResults = rawResults.map((rfi) =>
        enrichRfiResult(rfi, context.usersById, context.companiesById)
      );

      const warnings: Array<{ code: string; message: string; source: string }> = [];

      if (page.schemaWarning) {
        warnings.push({
          code: "rfis_page_schema_warning",
          message: page.schemaWarning,
          source: "acc_rfis_list"
        });
      }

      for (const warning of context.warnings) {
        warnings.push({
          code: "context_fetch_warning",
          message: warning,
          source: "acc_rfis_list"
        });
      }

      const payload = finalizePayload(
        buildMcpResponse({
          results: enrichedResults,
          pagination:
            page.pagination && typeof page.pagination === "object"
              ? (page.pagination as Record<string, unknown>)
              : {
                  limit: args.limit,
                  offset,
                  totalResults: enrichedResults.length,
                  returned: enrichedResults.length,
                  hasMore: false,
                  nextOffset: null
                },
          meta: {
            tool: "acc_rfis_list",
            generatedAt: new Date().toISOString(),
            source: "construction/rfis/v3/projects/:projectId/rfis",
            projectResolution: project,
            options: {
              fetchAll,
              limit: args.limit,
              offset,
              cursor: args.cursor,
              view: args.view,
              outputFields: args.outputFields,
              maxPages: args.maxPages,
              maxItems: args.maxItems,
              includeContext: args.includeContext,
              includeDictionaries: args.includeDictionaries
            },
            ...(args.includeContext && context.context ? { context: context.context } : {}),
            ...(args.includeContext && args.includeDictionaries && context.dictionaries
              ? { dictionaries: context.dictionaries }
              : {})
          },
          warnings
        }) as Record<string, unknown>
      );

      return { content: [{ type: "text", text: stringifyMcpPayload(payload) }] };
    }
  );
}
