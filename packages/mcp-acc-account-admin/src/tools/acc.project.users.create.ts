import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getAccAccessToken,
  resolveProject,
  normalizeProjectIdForConstruction,
  buildMcpResponse,
  stringifyMcpPayload
} from "@tad/shared";
import { createProjectUser } from "../acc/account-admin.client.js";
import { ProjectUsersCreateInputSchema } from "../schemas/account-admin.js";
import { finalizePayload } from "./_helpers.js";

type InputArgs = {
  hubId?: string;
  projectId?: string;
  projectName?: string;
  region?: "US" | "EMEA" | "AUS" | "CAN" | "DEU" | "IND" | "JPN" | "GBR";
  payload: Record<string, unknown>;
};

export function registerAccProjectUsersCreate(server: McpServer) {
  server.registerTool(
    "acc_project_users_create",
    {
      title: "ACC Project.Users.Create",
      description: "Crea un usuario en proyecto via Construction Admin.",
      inputSchema: ProjectUsersCreateInputSchema.shape
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

      const created = await createProjectUser({
        token,
        projectId: resolvedProject.projectId,
        payload: args.payload,
        region: args.region
      });

      const output = finalizePayload(
        "acc_project_users_create",
        buildMcpResponse({
          results: [created as Record<string, unknown>],
          pagination: {
            totalResults: 1,
            returned: 1,
            offset: 0,
            hasMore: false,
            nextOffset: null
          },
          meta: {
            tool: "acc_project_users_create",
            generatedAt: new Date().toISOString(),
            source: "construction/admin/v1/projects/:projectId/users",
            projectResolution: {
              source: resolvedProject.source,
              hubId: resolvedProject.hubId,
              requestedProjectName: resolvedProject.requestedProjectName,
              resolvedProjectName: resolvedProject.resolvedProjectName,
              rawProjectId: resolvedProject.rawProjectId,
              accountAdminProjectId: resolvedProject.projectId
            }
          }
        }) as Record<string, unknown>
      );

      return {
        content: [{ type: "text", text: stringifyMcpPayload(output) }]
      };
    }
  );
}
