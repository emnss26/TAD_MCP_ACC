import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAccAccessToken,
  resolveProject,
  normalizeProjectIdForConstruction,
  buildMcpResponse,
  type ResolveProjectResult,
  stringifyMcpPayload
} from "@tad/shared";
import { getAssetStatuses, getAssetCustomAttributes } from "../acc/assets.client.js";

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
  includeDictionaries: z
    .boolean()
    .default(false)
    .describe("Incluye diccionarios por ID para facilitar mapeos.")
});

type InputArgs = z.infer<typeof Input>;

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

async function resolveAssetsProject(args: InputArgs): Promise<ProjectResolution> {
  const resolvedProject = await resolveProject({
    projectId: args.projectId,
    projectName: args.projectName,
    hubId: args.hubId,
    envHubId: process.env.APS_HUB_ID,
    normalizeProjectId: normalizeProjectIdForConstruction
  });

  return {
    source: resolvedProject.source,
    hubId: resolvedProject.hubId,
    requestedProjectName: resolvedProject.requestedProjectName,
    resolvedProjectName: resolvedProject.resolvedProjectName,
    rawProjectId: resolvedProject.rawProjectId,
    assetsProjectId: resolvedProject.projectId
  };
}

export function registerAccAssetStatusesList(server: McpServer) {
  server.registerTool(
    "acc_assets_statuses_list",
    {
      title: "ACC Assets - List Statuses",
      description:
        "Lista los statuses de assets del proyecto (asset-statuses).",
      inputSchema: Input.shape
    },
    async (args: InputArgs) => {
      const token = await getAccAccessToken();
      const project = await resolveAssetsProject(args);
      const raw = await getAssetStatuses({
        token,
        projectId: project.assetsProjectId
      });
      const results = getResultsArray(raw);
      const dictionaries = {
        assetStatusesById: buildIdentityMap(results, ["id"])
      };

      const payload = buildMcpResponse({
        results,
        pagination: {
          limit: results.length,
          offset: 0,
          totalResults: results.length,
          returned: results.length,
          hasMore: false,
          nextOffset: null
        },
        meta: {
          tool: "acc_assets_statuses_list",
          generatedAt: new Date().toISOString(),
          source: "construction/assets/v1/projects/:projectId/asset-statuses",
          projectResolution: project,
          options: {
            includeDictionaries: args.includeDictionaries
          },
          ...(args.includeDictionaries ? { dictionaries } : {})
        }
      });

      return { content: [{ type: "text", text: stringifyMcpPayload(payload) }] };
    }
  );
}

export function registerAccAssetCustomAttributesList(server: McpServer) {
  server.registerTool(
    "acc_assets_custom_attributes_list",
    {
      title: "ACC Assets - List Custom Attributes",
      description:
        "Lista los custom attributes de assets del proyecto.",
      inputSchema: Input.shape
    },
    async (args: InputArgs) => {
      const token = await getAccAccessToken();
      const project = await resolveAssetsProject(args);
      const raw = await getAssetCustomAttributes({
        token,
        projectId: project.assetsProjectId
      });
      const results = getResultsArray(raw);
      const dictionaries = {
        customAttributesById: buildIdentityMap(results, ["id"])
      };

      const payload = buildMcpResponse({
        results,
        pagination: {
          limit: results.length,
          offset: 0,
          totalResults: results.length,
          returned: results.length,
          hasMore: false,
          nextOffset: null
        },
        meta: {
          tool: "acc_assets_custom_attributes_list",
          generatedAt: new Date().toISOString(),
          source: "construction/assets/v1/projects/:projectId/custom-attributes",
          projectResolution: project,
          options: {
            includeDictionaries: args.includeDictionaries
          },
          ...(args.includeDictionaries ? { dictionaries } : {})
        }
      });

      return { content: [{ type: "text", text: stringifyMcpPayload(payload) }] };
    }
  );
}
