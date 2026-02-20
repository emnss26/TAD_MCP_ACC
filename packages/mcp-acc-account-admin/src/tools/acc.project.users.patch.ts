import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getAccAccessToken,
  resolveProject,
  normalizeProjectIdForConstruction,
  buildMcpResponse,
  stringifyMcpPayload
} from "@tad/shared";
import { patchProjectUser } from "../acc/account-admin.client.js";
import { ProjectUsersPatchInputSchema } from "../schemas/account-admin.js";
import { finalizePayload } from "./_helpers.js";

type InputArgs = {
  hubId?: string;
  projectId?: string;
  projectName?: string;
  userId: string;
  region?: "US" | "EMEA" | "AUS" | "CAN" | "DEU" | "IND" | "JPN" | "GBR";
  payload: Record<string, unknown>;
  confirm: boolean;
};

export function registerAccProjectUsersPatch(server: McpServer) {
  server.registerTool(
    "acc_project_users_patch",
    {
      title: "ACC Project.Users.Patch",
      description:
        "Actualiza un usuario de proyecto en Construction Admin (requiere confirm=true).",
      inputSchema: ProjectUsersPatchInputSchema.shape
    },
    async (args: InputArgs) => {
      const resolvedProject = await resolveProject({
        projectId: args.projectId,
        projectName: args.projectName,
        hubId: args.hubId,
        envHubId: process.env.APS_HUB_ID,
        normalizeProjectId: normalizeProjectIdForConstruction
      });

      if (!args.confirm) {
        const preview = finalizePayload(
          "acc_project_users_patch",
          buildMcpResponse({
            results: [
              {
                dryRun: true,
                target: {
                  projectId: resolvedProject.projectId,
                  userId: args.userId
                },
                payload: args.payload
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
              tool: "acc_project_users_patch",
              generatedAt: new Date().toISOString(),
              source: "construction/admin/v1/projects/:projectId/users/:userId",
              requiresConfirmation: true
            },
            warnings: [
              {
                code: "confirmation_required",
                message:
                  "Cambio sensible no ejecutado. Repite la llamada con confirm=true para aplicar el PATCH.",
                source: "acc_project_users_patch"
              }
            ]
          }) as Record<string, unknown>
        );

        return {
          content: [{ type: "text", text: stringifyMcpPayload(preview) }]
        };
      }

      const token = await getAccAccessToken();
      const patched = await patchProjectUser({
        token,
        projectId: resolvedProject.projectId,
        userId: args.userId,
        payload: args.payload,
        region: args.region
      });

      const output = finalizePayload(
        "acc_project_users_patch",
        buildMcpResponse({
          results: [patched as Record<string, unknown>],
          pagination: {
            totalResults: 1,
            returned: 1,
            offset: 0,
            hasMore: false,
            nextOffset: null
          },
          meta: {
            tool: "acc_project_users_patch",
            generatedAt: new Date().toISOString(),
            source: "construction/admin/v1/projects/:projectId/users/:userId",
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
