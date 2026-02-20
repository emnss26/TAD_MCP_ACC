import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getAccAccessToken,
  resolveProject,
  normalizeProjectIdForConstruction,
  buildMcpResponse,
  stringifyMcpPayload
} from "@tad/shared";
import { createSubmittalItem } from "../acc/submittals.client.js";
import { CreateSubmittalInputSchema } from "../schemas/submittals.js";

export function registerAccSubmittalsCreate(server: McpServer) {
  server.registerTool(
    "acc_submittals_create",
    {
      title: "ACC Submittals - Create",
      description: "Crea un submittal item en ACC.",
      inputSchema: CreateSubmittalInputSchema.shape
    },
    async (args) => {
      const token = await getAccAccessToken();

      const resolvedProject = await resolveProject({
        projectId: args.projectId,
        projectName: args.projectName,
        hubId: args.hubId,
        envHubId: process.env.APS_HUB_ID,
        normalizeProjectId: normalizeProjectIdForConstruction
      });

      const created = await createSubmittalItem({
        token,
        projectId: resolvedProject.projectId,
        payload: args.payload
      });

      const output = buildMcpResponse({
        results: [created as Record<string, unknown>],
        pagination: {
          totalResults: 1,
          returned: 1,
          offset: 0,
          hasMore: false,
          nextOffset: null
        },
        meta: {
          tool: "acc_submittals_create",
          generatedAt: new Date().toISOString(),
          source: "construction/submittals/v2/projects/:projectId/items",
          projectResolution: {
            source: resolvedProject.source,
            hubId: resolvedProject.hubId,
            requestedProjectName: resolvedProject.requestedProjectName,
            resolvedProjectName: resolvedProject.resolvedProjectName,
            rawProjectId: resolvedProject.rawProjectId,
            submittalsProjectId: resolvedProject.projectId
          }
        }
      });

      return {
        content: [{ type: "text", text: stringifyMcpPayload(output) }]
      };
    }
  );
}
