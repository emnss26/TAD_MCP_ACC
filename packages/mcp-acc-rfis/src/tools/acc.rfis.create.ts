import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getAccAccessToken,
  resolveProject,
  normalizeProjectIdForConstruction,
  buildMcpResponse,
  stringifyMcpPayload
} from "@tad/shared";
import { createRfi } from "../acc/rfis.client.js";
import { CreateRfiInputSchema } from "../schemas/rfis.js";

export function registerAccRfiCreate(server: McpServer) {
  server.registerTool(
    "acc_rfis_create",
    {
      title: "ACC RFIs - Create",
      description: "Crea un RFI en ACC usando projectId o projectName + hubId.",
      inputSchema: CreateRfiInputSchema.shape
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
        title: args.title,
        question: args.question,
        status: args.status,
        ...(args.suggestedAnswer ? { suggestedAnswer: args.suggestedAnswer } : {}),
        ...(args.dueDate ? { dueDate: args.dueDate } : {}),
        ...(args.rfiTypeId ? { rfiTypeId: args.rfiTypeId } : {}),
        ...(args.customIdentifier ? { customIdentifier: args.customIdentifier } : {}),
        ...(args.customAttributes ? { customAttributes: args.customAttributes } : {}),
        ...(args.additionalPayload ?? {})
      };

      const created = await createRfi({
        token,
        projectId: resolvedProject.projectId,
        payload,
        region: args.region
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
          tool: "acc_rfis_create",
          generatedAt: new Date().toISOString(),
          source: "construction/rfis/v3/projects/:projectId/rfis",
          options: {
            region: args.region
          },
          projectResolution: {
            source: resolvedProject.source,
            hubId: resolvedProject.hubId,
            requestedProjectName: resolvedProject.requestedProjectName,
            resolvedProjectName: resolvedProject.resolvedProjectName,
            rawProjectId: resolvedProject.rawProjectId,
            rfisProjectId: resolvedProject.projectId
          }
        }
      });

      return {
        content: [{ type: "text", text: stringifyMcpPayload(output) }]
      };
    }
  );
}
