import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AecElementQuerySchema } from "../schemas/aec.js";
import { aecFetch, GET_ELEMENT_DETAILS_QUERY } from "../aec/aec.client.js";

export function registerAecQuantities(server: McpServer) {
  server.registerTool(
    "aec_get_quantities",
    {
      title: "AEC Data Model - Universal Query",
      description: "Consulta avanzada de elementos de Revit. Permite filtrar por cualquier parámetro (categoría, material, dimensiones) y extraer sus valores técnicos.",
      inputSchema: AecElementQuerySchema.shape,
    },
    async (args) => {
      const filter: any = {
        query: args.filterQuery 
      };

      const data = await aecFetch(GET_ELEMENT_DETAILS_QUERY, {
        projectId: args.projectId,
        filter: filter
      });

      const results = data.elementsByProject.results;

      if (!results || results.length === 0) {
        return {
          content: [{ type: "text", text: "No se encontraron elementos con esos criterios de búsqueda." }]
        };
      }

      // Mapeo inteligente
      const report = results.map((el: any) => {
        const item: any = { 
          name: el.name,
          id: el.id 
        };

        el.properties.results.forEach((p: any) => {
          // Si el usuario especificó propiedades, solo mostramos esas. 
          // Si no, mostramos todo lo que tenga valor.
          if (!args.propertiesToFetch || args.propertiesToFetch.includes(p.name)) {
            item[p.name] = p.displayValue;
          }
        });
        return item;
      });

      return {
        content: [{ 
          type: "text", 
          text: `Se encontraron ${report.length} elementos:\n\n${JSON.stringify(report, null, 2)}` 
        }]
      };
    }
  );
}