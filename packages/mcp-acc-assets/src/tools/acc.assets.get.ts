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
import {
  listAssets,
  getAssetCategories,
  getAssetStatusStepSets,
  getAssetStatuses,
  getAssetCustomAttributes
} from "../acc/assets.client.js";
import { getProjectUsers, getProjectCompanies } from "../acc/admin.client.js";
import { AssetsPaginationSchema } from "../schemas/pagination.js";
import { AssetListResponseSchema, AssetToolResponseSchema } from "../schemas/assets.js";

type AssetResult = Record<string, unknown>;

type AssetListPage = PaginatedResponse<AssetResult> & {
  schemaWarning?: string;
};

type ProjectResolution = Omit<ResolveProjectResult, "projectId"> & {
  assetsProjectId: string;
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
    .describe("Incluye usuarios, companias, categorias, estados y custom attributes."),
  includeDictionaries: z
    .boolean()
    .default(false)
    .describe("Incluye diccionarios por ID para facilitar el mapeo."),
  ...AssetsPaginationSchema
});

type InputArgs = z.infer<typeof Input>;

function parseAssetPage(raw: unknown): AssetListPage {
  const parsed = AssetListResponseSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data as AssetListPage;
  }

  if (raw && typeof raw === "object") {
    return {
      ...(raw as AssetListPage),
      schemaWarning:
        "La respuesta de Assets incluye campos/formatos fuera del schema esperado."
    };
  }

  return {
    results: [],
    schemaWarning: "La respuesta de Assets no tiene un formato JSON valido."
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

function getEntityById(
  id: unknown,
  map: Record<string, Record<string, unknown>>
): Record<string, unknown> | null {
  if (typeof id !== "string" || !id.trim()) {
    return null;
  }
  return map[id] ?? { id, unresolved: true };
}

function getCustomAttributesObject(
  value: unknown
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function toStringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function buildOptionsById(
  definition: Record<string, unknown> | null
): Record<string, Record<string, unknown>> {
  if (!definition) return {};

  const fromRoot = Array.isArray(definition.options)
    ? (definition.options as Array<Record<string, unknown>>)
    : [];

  const metadata = definition.metadata;
  const metadataOptions =
    metadata &&
    typeof metadata === "object" &&
    (metadata as any).list &&
    typeof (metadata as any).list === "object" &&
    Array.isArray((metadata as any).list.options)
      ? ((metadata as any).list.options as Array<Record<string, unknown>>)
      : [];

  const allOptions = [...fromRoot, ...metadataOptions];
  const map: Record<string, Record<string, unknown>> = {};
  for (const option of allOptions) {
    const optionId =
      toStringValue(option.id) ??
      toStringValue(option.value) ??
      toStringValue(option.name);
    if (optionId) {
      map[optionId] = option;
    }
  }
  return map;
}

function resolveCustomAttributeValue(
  raw: unknown,
  optionsById: Record<string, Record<string, unknown>>
): unknown {
  if (Array.isArray(raw)) {
    return raw.map((item) =>
      resolveCustomAttributeValue(item, optionsById)
    );
  }

  if (typeof raw !== "string" || !raw.trim()) {
    return raw;
  }

  if (raw in optionsById) {
    return optionsById[raw];
  }

  return raw;
}

function resolveCustomAttributes(
  customAttributes: Record<string, unknown>,
  customAttributesById: Record<string, Record<string, unknown>>
) {
  const resolved: Array<Record<string, unknown>> = [];

  for (const [attributeId, rawValue] of Object.entries(customAttributes)) {
    const definition = customAttributesById[attributeId] ?? null;
    const optionsById = buildOptionsById(definition);
    resolved.push({
      id: attributeId,
      name:
        toStringValue(definition?.name) ??
        toStringValue(definition?.title) ??
        attributeId,
      dataType:
        toStringValue(definition?.dataType) ??
        toStringValue(definition?.type),
      value: rawValue,
      resolvedValue: resolveCustomAttributeValue(
        rawValue,
        optionsById
      )
    });
  }

  return resolved;
}

function enrichAssetResult(
  asset: AssetResult,
  assetStatusesById: Record<string, Record<string, unknown>>,
  customAttributesById: Record<string, Record<string, unknown>>
) {
  const statusId =
    (typeof asset.assetStatusId === "string" && asset.assetStatusId) ||
    (typeof asset.statusId === "string" && (asset.statusId as string)) ||
    null;

  const customAttributes = getCustomAttributesObject(asset.customAttributes);
  const resolvedCustomAttributes = resolveCustomAttributes(
    customAttributes,
    customAttributesById
  );

  return {
    id: asset.id ?? null,
    clientAssetId: asset.clientAssetId ?? asset.name ?? null,
    description: asset.description ?? null,
    barcode: asset.barcode ?? null,
    statusId,
    resolvedStatus: getEntityById(statusId, assetStatusesById),
    customAttributes,
    resolvedCustomAttributes
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
  categoriesById: Record<string, Record<string, unknown>>;
  statusStepSetsById: Record<string, Record<string, unknown>>;
  assetStatusesById: Record<string, Record<string, unknown>>;
  customAttributesById: Record<string, Record<string, unknown>>;
}> {
  if (!enabled) {
    const [statusesRes, customAttrsRes] = await Promise.allSettled([
      getAssetStatuses({ token, projectId }),
      getAssetCustomAttributes({ token, projectId })
    ]);

    const warnings: string[] = [];
    const assetStatuses =
      statusesRes.status === "fulfilled" ? getResultsArray(statusesRes.value) : [];
    const customAttributes =
      customAttrsRes.status === "fulfilled" ? getResultsArray(customAttrsRes.value) : [];

    if (statusesRes.status === "rejected") {
      warnings.push(`No se pudieron obtener asset-statuses: ${String(statusesRes.reason)}`);
    }
    if (customAttrsRes.status === "rejected") {
      warnings.push(
        `No se pudieron obtener custom-attributes de assets: ${String(customAttrsRes.reason)}`
      );
    }

    return {
      warnings,
      usersById: {},
      companiesById: {},
      categoriesById: {},
      statusStepSetsById: {},
      assetStatusesById: buildIdentityMap(assetStatuses, ["id"]),
      customAttributesById: buildIdentityMap(customAttributes, ["id"])
    };
  }

  const warnings: string[] = [];
  const [usersRes, companiesRes, categoriesRes, stepSetsRes, statusesRes, customAttrsRes] =
    await Promise.allSettled([
      getProjectUsers(projectId),
      getProjectCompanies(projectId),
      getAssetCategories({ token, projectId }),
      getAssetStatusStepSets({ token, projectId }),
      getAssetStatuses({ token, projectId }),
      getAssetCustomAttributes({ token, projectId })
    ]);

  const users = usersRes.status === "fulfilled" ? getResultsArray(usersRes.value) : [];
  const companies =
    companiesRes.status === "fulfilled" ? getResultsArray(companiesRes.value) : [];
  const categories =
    categoriesRes.status === "fulfilled" ? getResultsArray(categoriesRes.value) : [];
  const statusStepSets =
    stepSetsRes.status === "fulfilled" ? getResultsArray(stepSetsRes.value) : [];
  const assetStatuses =
    statusesRes.status === "fulfilled" ? getResultsArray(statusesRes.value) : [];
  const customAttributes =
    customAttrsRes.status === "fulfilled" ? getResultsArray(customAttrsRes.value) : [];

  if (usersRes.status === "rejected") {
    warnings.push(`No se pudieron obtener usuarios: ${String(usersRes.reason)}`);
  }
  if (companiesRes.status === "rejected") {
    warnings.push(`No se pudieron obtener companias: ${String(companiesRes.reason)}`);
  }
  if (categoriesRes.status === "rejected") {
    warnings.push(`No se pudieron obtener categorias de assets: ${String(categoriesRes.reason)}`);
  }
  if (stepSetsRes.status === "rejected") {
    warnings.push(
      `No se pudieron obtener status-step-sets de assets: ${String(stepSetsRes.reason)}`
    );
  }
  if (statusesRes.status === "rejected") {
    warnings.push(`No se pudieron obtener asset-statuses: ${String(statusesRes.reason)}`);
  }
  if (customAttrsRes.status === "rejected") {
    warnings.push(
      `No se pudieron obtener custom-attributes de assets: ${String(customAttrsRes.reason)}`
    );
  }

  const usersById = buildIdentityMap(users, ["autodeskId", "id"]);
  const companiesById = buildIdentityMap(companies, ["id"]);
  const categoriesById = buildIdentityMap(categories, ["id"]);
  const statusStepSetsById = buildIdentityMap(statusStepSets, ["id"]);
  const assetStatusesById = buildIdentityMap(assetStatuses, ["id"]);
  const customAttributesById = buildIdentityMap(customAttributes, ["id"]);

  return {
    context: {
      users,
      companies,
      categories,
      statusStepSets,
      assetStatuses,
      customAttributes
    },
    dictionaries: {
      usersById,
      companiesById,
      categoriesById,
      statusStepSetsById,
      assetStatusesById,
      customAttributesById
    },
    warnings,
    usersById,
    companiesById,
    categoriesById,
    statusStepSetsById,
    assetStatusesById,
    customAttributesById
  };
}

function finalizePayload(payload: Record<string, unknown>) {
  const parsed = AssetToolResponseSchema.safeParse(payload);
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
        message: "La respuesta final de acc_assets_list incluye campos/formatos fuera del schema esperado.",
        source: "acc_assets_list"
      }
    ]
  };
}

export function registerAccAssetsList(server: McpServer) {
  server.registerTool(
    "acc_assets_list",
    {
      title: "ACC Assets - List",
      description:
        "Lista assets de ACC. Puede resolver projectId desde projectName + hubId y anade contexto.",
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
        assetsProjectId: resolvedProject.projectId
      };

      const page = await fetchAllPages<AssetListPage, AssetResult>({
        fetchAll,
        limit: args.limit,
        offset,
        maxPages: args.maxPages,
        maxItems: args.maxItems,
        fetchPage: async ({ limit, offset }) =>
          parseAssetPage(
            await listAssets({
              token,
              projectId: project.assetsProjectId,
              limit,
              offset
            })
          )
      });

      const context = await fetchContext(token, project.assetsProjectId, args.includeContext);

      const rawResults = Array.isArray(page.results) ? page.results : [];
      const enrichedResults = rawResults.map((asset) =>
        enrichAssetResult(
          asset,
          context.assetStatusesById,
          context.customAttributesById
        )
      );

      const warnings: Array<{ code: string; message: string; source: string }> = [];

      if (page.schemaWarning) {
        warnings.push({
          code: "assets_page_schema_warning",
          message: page.schemaWarning,
          source: "acc_assets_list"
        });
      }

      for (const warning of context.warnings) {
        warnings.push({
          code: "context_fetch_warning",
          message: warning,
          source: "acc_assets_list"
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
            tool: "acc_assets_list",
            generatedAt: new Date().toISOString(),
            source: "construction/assets/v2/projects/:projectId/assets",
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
