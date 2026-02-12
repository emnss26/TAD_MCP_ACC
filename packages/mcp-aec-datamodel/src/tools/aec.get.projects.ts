import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AecProjectSchema } from "../schemas/aec.js";
import { aecFetch, GET_PROJECTS_QUERY } from "../aec/aec.client.js";

export function registerAecProjects(server: McpServer) {
  server.registerTool(
    "aec_get_projects",
    {
      title: "AEC Data Model - List Projects",
      description: "Obtiene la lista de proyectos con sus IDs en formato GraphQL (Base64). Necesario para consultas de elementos.",
      inputSchema: AecProjectSchema.shape,
    },
    async (args) => {
      const data = await aecFetch(GET_PROJECTS_QUERY, { hubId: args.hubId });
      return {
        content: [{ type: "text", text: JSON.stringify(data.projects.results, null, 2) }]
      };
    }
  );
}