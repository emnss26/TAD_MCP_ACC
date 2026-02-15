import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAccAccessToken,
  fetchAllPages,
  resolveProject,
  normalizeProjectIdForConstruction,
  buildMcpResponse,
  type PaginatedResponse,
  type ResolveProjectResult,
  stringifyMcpPayload
} from "@tad/shared";
import {
  listSubmittalItems,
  getSubmittalItemTypes,
  getSubmittalResponses,
  getSubmittalSpecs
} from "../acc/submittals.client.js";
import { getProjectUsers, getProjectCompanies } from "../acc/admin.client.js";
import { SubmittalsPaginationSchema } from "../schemas/pagination.js";
import {
  SubmittalListResponseSchema,
  SubmittalToolResponseSchema
} from "../schemas/submittals.js";

type SubmittalResult = Record<string, unknown>;

type SubmittalListPage = PaginatedResponse<SubmittalResult> & {
  schemaWarning?: string;
};

type ProjectResolution = Omit<ResolveProjectResult, "projectId"> & {
  submittalsProjectId: string;
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
    .default(true)
    .describe("Incluye usuarios, companias, item types, responses y specs."),
  includeDictionaries: z
    .boolean()
    .default(true)
    .describe("Incluye diccionarios por ID para facilitar el mapeo."),
  ...SubmittalsPaginationSchema
});

type InputArgs = z.infer<typeof Input>;

function parseSubmittalPage(raw: unknown): SubmittalListPage {
  const parsed = SubmittalListResponseSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data as SubmittalListPage;
  }

  if (raw && typeof raw === "object") {
    return {
      ...(raw as SubmittalListPage),
      schemaWarning:
        "La respuesta de Submittals incluye campos/formatos fuera del schema esperado."
    };
  }

  return {
    results: [],
    schemaWarning: "La respuesta de Submittals no tiene un formato JSON valido."
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

function getEntityById(
  id: unknown,
  map: Record<string, Record<string, unknown>>
): Record<string, unknown> | null {
  if (typeof id !== "string" || !id.trim()) {
    return null;
  }
  return map[id] ?? { id, unresolved: true };
}

function enrichSubmittalResult(
  submittal: SubmittalResult,
  usersById: Record<string, Record<string, unknown>>,
  companiesById: Record<string, Record<string, unknown>>,
  itemTypesById: Record<string, Record<string, unknown>>,
  responsesById: Record<string, Record<string, unknown>>,
  specsById: Record<string, Record<string, unknown>>
) {
  return {
    ...submittal,
    resolvedItemType: getEntityById(submittal.itemTypeId, itemTypesById),
    resolvedResponse: getEntityById(submittal.responseId, responsesById),
    resolvedSpec: getEntityById(submittal.specId, specsById),
    resolvedActors: {
      manager: resolveIdentity(submittal.manager, usersById, companiesById),
      assignedTo: resolveIdentity(submittal.assignedTo, usersById, companiesById),
      createdBy: resolveIdentity(submittal.createdBy, usersById, companiesById),
      updatedBy: resolveIdentity(submittal.updatedBy, usersById, companiesById)
    }
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
  itemTypesById: Record<string, Record<string, unknown>>;
  responsesById: Record<string, Record<string, unknown>>;
  specsById: Record<string, Record<string, unknown>>;
}> {
  if (!enabled) {
    return {
      warnings: [],
      usersById: {},
      companiesById: {},
      itemTypesById: {},
      responsesById: {},
      specsById: {}
    };
  }

  const warnings: string[] = [];
  const [usersRes, companiesRes, itemTypesRes, responsesRes, specsRes] =
    await Promise.allSettled([
      getProjectUsers(projectId),
      getProjectCompanies(projectId),
      getSubmittalItemTypes({ token, projectId }),
      getSubmittalResponses({ token, projectId }),
      getSubmittalSpecs({ token, projectId })
    ]);

  const users = usersRes.status === "fulfilled" ? getResultsArray(usersRes.value) : [];
  const companies =
    companiesRes.status === "fulfilled" ? getResultsArray(companiesRes.value) : [];
  const itemTypes =
    itemTypesRes.status === "fulfilled" ? getResultsArray(itemTypesRes.value) : [];
  const responses =
    responsesRes.status === "fulfilled" ? getResultsArray(responsesRes.value) : [];
  const specs = specsRes.status === "fulfilled" ? getResultsArray(specsRes.value) : [];

  if (usersRes.status === "rejected") {
    warnings.push(`No se pudieron obtener usuarios: ${String(usersRes.reason)}`);
  }
  if (companiesRes.status === "rejected") {
    warnings.push(`No se pudieron obtener companias: ${String(companiesRes.reason)}`);
  }
  if (itemTypesRes.status === "rejected") {
    warnings.push(`No se pudieron obtener item-types: ${String(itemTypesRes.reason)}`);
  }
  if (responsesRes.status === "rejected") {
    warnings.push(`No se pudieron obtener responses: ${String(responsesRes.reason)}`);
  }
  if (specsRes.status === "rejected") {
    warnings.push(`No se pudieron obtener specs: ${String(specsRes.reason)}`);
  }

  const usersById = buildIdentityMap(users, ["autodeskId", "id"]);
  const companiesById = buildIdentityMap(companies, ["id"]);
  const itemTypesById = buildIdentityMap(itemTypes, ["id"]);
  const responsesById = buildIdentityMap(responses, ["id"]);
  const specsById = buildIdentityMap(specs, ["id"]);

  return {
    context: {
      users,
      companies,
      itemTypes,
      responses,
      specs
    },
    dictionaries: {
      usersById,
      companiesById,
      itemTypesById,
      responsesById,
      specsById
    },
    warnings,
    usersById,
    companiesById,
    itemTypesById,
    responsesById,
    specsById
  };
}

function finalizePayload(payload: Record<string, unknown>) {
  const parsed = SubmittalToolResponseSchema.safeParse(payload);
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
        message:
          "La respuesta final de acc_submittals_list incluye campos/formatos fuera del schema esperado.",
        source: "acc_submittals_list"
      }
    ]
  };
}

export function registerAccSubmittalsList(server: McpServer) {
  server.registerTool(
    "acc_submittals_list",
    {
      title: "ACC Submittals - List",
      description:
        "Lista submittals de ACC. Puede resolver projectId desde projectName + hubId y anade contexto.",
      inputSchema: Input.shape
    },
    async (args: InputArgs) => {
      const token = await getAccAccessToken();

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
        submittalsProjectId: resolvedProject.projectId
      };

      const page = await fetchAllPages<SubmittalListPage, SubmittalResult>({
        fetchAll: args.fetchAll,
        limit: args.limit,
        offset: args.offset,
        maxPages: args.maxPages,
        maxItems: args.maxItems,
        fetchPage: async ({ limit, offset }) =>
          parseSubmittalPage(
            await listSubmittalItems({
              token,
              projectId: project.submittalsProjectId,
              limit,
              offset
            })
          )
      });

      const context = await fetchContext(token, project.submittalsProjectId, args.includeContext);

      const rawResults = Array.isArray(page.results) ? page.results : [];
      const enrichedResults = rawResults.map((submittal) =>
        enrichSubmittalResult(
          submittal,
          context.usersById,
          context.companiesById,
          context.itemTypesById,
          context.responsesById,
          context.specsById
        )
      );

      const warnings: Array<{ code: string; message: string; source: string }> = [];

      if (page.schemaWarning) {
        warnings.push({
          code: "submittals_page_schema_warning",
          message: page.schemaWarning,
          source: "acc_submittals_list"
        });
      }

      for (const warning of context.warnings) {
        warnings.push({
          code: "context_fetch_warning",
          message: warning,
          source: "acc_submittals_list"
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
                  offset: args.offset,
                  totalResults: enrichedResults.length,
                  returned: enrichedResults.length,
                  hasMore: false,
                  nextOffset: null
                },
          meta: {
            tool: "acc_submittals_list",
            generatedAt: new Date().toISOString(),
            source: "construction/submittals/v2/projects/:projectId/items",
            projectResolution: project,
            options: {
              fetchAll: args.fetchAll,
              limit: args.limit,
              offset: args.offset,
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
