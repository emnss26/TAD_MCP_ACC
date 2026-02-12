import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AecElementSchema } from "../schemas/aec.js";
import { aecFetch, GET_ELEMENT_DATA_QUERY } from "../aec/aec.client.js";

export function registerAecQuantities(server: McpServer) {
  server.registerTool(
    "aec_get_quantities",
    {
      title: "AEC Data Model - Quantities",
      description: "Consulta propiedades y cantidades de elementos del modelo de Revit (Áreas, Volúmenes, etc.)",
      inputSchema: AecElementSchema.shape,
    },
    async (args) => {
      // Construimos un filtro básico para GraphQL
      const filter: any = {};
      if (args.category) filter.category = { equals: args.category };
      
      const data = await aecFetch(GET_ELEMENT_DATA_QUERY, {
        projectId: args.projectId,
        filter: filter
      });

      const results = data.elementsByProject.results;
      
      // Si el usuario pidió un tipo específico (ej: w01), Claude filtrará en la respuesta
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }]
      };
    }
  );
}