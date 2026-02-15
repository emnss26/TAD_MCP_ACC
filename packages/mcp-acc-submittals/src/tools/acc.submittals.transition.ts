import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getAccAccessToken,
  resolveProject,
  normalizeProjectIdForConstruction,
  buildMcpResponse,
  stringifyMcpPayload
} from "@tad/shared";
import { transitionSubmittalItem } from "../acc/submittals.client.js";
import { TransitionSubmittalInputSchema } from "../schemas/submittals.js";

export function registerAccSubmittalsTransition(server: McpServer) {
  server.registerTool(
    "acc_submittals_transition",
    {
      title: "ACC Submittals - Transition Item",
      description:
        "Ejecuta la transicion de estado para un submittal item en ACC.",
      inputSchema: TransitionSubmittalInputSchema.shape
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

      const payload = {
        stateId: args.stateId,
        ...(args.manager ? { manager: args.manager } : {}),
        ...(args.managerType ? { managerType: args.managerType } : {}),
        ...(args.duplicateAttachments
          ? { duplicateAttachments: args.duplicateAttachments }
          : {}),
        ...(args.responseComment ? { responseComment: args.responseComment } : {}),
        ...(args.responseId ? { responseId: args.responseId } : {}),
        ...(args.additionalPayload ?? {})
      };

      const response = await transitionSubmittalItem({
        token,
        projectId: resolvedProject.projectId,
        itemId: args.itemId,
        payload
      });

      const output = buildMcpResponse({
        results: [
          {
            itemId: args.itemId,
            requestedStateId: args.stateId,
            transitionResponse: response
          }
        ],
        pagination: {
          totalResults: 1,
          returned: 1,
          offset: 0,
          hasMore: false,
          nextOffset: null
        },
        meta: {
          tool: "acc_submittals_transition",
          generatedAt: new Date().toISOString(),
          source: "construction/submittals/v2/projects/:projectId/items/:itemId:transition",
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
