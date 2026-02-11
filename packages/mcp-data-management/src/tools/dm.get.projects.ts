import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HubIdSchema } from "../schemas/dm.js";
import { getHubProjects } from "../dm/dm.client.js";

export function registerGetProjects(server: McpServer) {
  server.registerTool(
    "dm_get_projects",
    {
      title: "Data Management - List Projects",
      description: "Lista todos los proyectos en un Hub para encontrar sus IDs.",
      inputSchema: HubIdSchema.shape,
    },
    async (args) => {
      const hubId = args.hubId || process.env.APS_HUB_ID;
      if (!hubId) throw new Error("Falta APS_HUB_ID en las variables de entorno.");

      const projects = await getHubProjects(hubId);
      
      // Formateamos una respuesta amigable para que Claude la lea
      const list = projects.map((p: any) => `- ${p.attributes.name} (ID: ${p.id})`).join("\n");

      return {
        content: [{ type: "text", text: `Proyectos encontrados en el Hub:\n\n${list}` }]
      };
    }
  );
}