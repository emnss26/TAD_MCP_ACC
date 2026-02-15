import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stringifyMcpPayload } from "@tad/shared";
import { AecElementQuerySchema } from "../schemas/aec.js";
import {
  getAecElementsByProject,
  getGraphQLProjectId,
} from "../aec/aec.client.js";

export function registerAecQuantities(server: McpServer) {
  server.registerTool(
    "aec_get_quantities",
    {
      title: "AEC Data Model - Get Quantities",
      description: "Obtiene elementos y propiedades para cuantificacion basica.",
      inputSchema: AecElementQuerySchema.shape,
    },
    async (args) => {
      try {
        const gqlProjectId = await getGraphQLProjectId(
          args.classicHubId,
          args.classicProjectId
        );

        const filterQuery = args.category
          ? `property.name.category == '${args.category}'`
          : undefined;

        const elements = await getAecElementsByProject(gqlProjectId, {
          filterQuery,
        });

        return {
          content: [
            {
              type: "text",
              text: stringifyMcpPayload(elements),
            },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[AEC Error] ${message}`);

        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error al obtener cantidades: ${message}`,
            },
          ],
        };
      }
    }
  );
}
