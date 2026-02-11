import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ProjectIdSchema } from "../schemas/dm.js";
import { getProjectDetails } from "../dm/dm.client.js";

export function registerGetProjectDetails(server: McpServer) {
  server.registerTool(
    "dm_get_project_details",
    {
      title: "DM - Project Details",
      description: "Obtiene información detallada del proyecto, incluyendo IDs de contenedores para Issues, RFIs y Folders.",
      inputSchema: ProjectIdSchema.shape,
    },
    async (args) => {
      const hubId = args.hubId || process.env.APS_HUB_ID;
      if (!hubId) throw new Error("Falta APS_HUB_ID.");

      const raw = await getProjectDetails(hubId, args.projectId);
      const data = raw.data;
      const rels = data.relationships;

      // Simplificamos la respuesta para no saturar el contexto de Claude
      const summary = {
        name: data.attributes.name,
        type: data.attributes.extension.data.projectType,
        ids: {
          project: data.id,
          rootFolder: rels.rootFolder?.data?.id,
          issueContainer: rels.issues?.data?.id,
          submittalContainer: rels.submittals?.data?.id,
          costContainer: rels.cost?.data?.id
        },
        links: {
          webView: data.links.webView.href
        }
      };

      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }]
      };
    }
  );
}