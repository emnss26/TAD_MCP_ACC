import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildMcpResponse,
  stringifyMcpPayload
} from "@tad/shared";
import { ProjectIdSchema } from "../schemas/dm.js";
import { getProjectDetails } from "../dm/dm.client.js";

export function registerGetProjectDetails(server: McpServer) {
  server.registerTool(
    "dm_get_project_details",
    {
      title: "DM - Project Details",
      description:
        "Obtiene informacion detallada del proyecto, incluyendo IDs de contenedores para Issues, RFIs y Folders.",
      inputSchema: ProjectIdSchema.shape
    },
    async (args) => {
      const hubId = args.hubId || process.env.APS_HUB_ID;
      if (!hubId) throw new Error("Falta APS_HUB_ID.");

      const raw = await getProjectDetails(hubId, args.projectId);
      const data = raw?.data ?? {};
      const rels = data?.relationships ?? {};

      const result = {
        id: data?.id ?? null,
        name: data?.attributes?.name ?? null,
        projectType: data?.attributes?.extension?.data?.projectType ?? null,
        projectStatus: data?.attributes?.extension?.data?.projectStatus ?? null,
        ids: {
          project: data?.id ?? null,
          rootFolder: rels?.rootFolder?.data?.id ?? null,
          issueContainer: rels?.issues?.data?.id ?? null,
          submittalContainer: rels?.submittals?.data?.id ?? null,
          costContainer: rels?.cost?.data?.id ?? null
        },
        links: {
          webView: data?.links?.webView?.href ?? null
        }
      };

      const payload = buildMcpResponse({
        results: [result],
        pagination: {
          totalResults: 1,
          returned: 1,
          offset: 0,
          hasMore: false,
          nextOffset: null
        },
        meta: {
          tool: "dm_get_project_details",
          generatedAt: new Date().toISOString(),
          source: "project.v1/hubs/:hubId/projects/:projectId",
          hubId,
          projectId: args.projectId
        }
      });

      return {
        content: [{ type: "text", text: stringifyMcpPayload(payload) }]
      };
    }
  );
}
