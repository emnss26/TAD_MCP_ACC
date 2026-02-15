import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stringifyMcpPayload } from "@tad/shared";
import { AecHubsQuerySchema } from "../schemas/aec.js";
import { getAecHubs } from "../aec/aec.client.js";

export function registerAecHubs(server: McpServer) {
  server.registerTool(
    "aec_get_hubs",
    {
      title: "AEC Data Model - List Hubs",
      description: "Lista hubs disponibles en AEC Data Model para seleccionar hubId.",
      inputSchema: AecHubsQuerySchema.shape,
    },
    async (args) => {
      try {
        const hubs = await getAecHubs({
          filterQuery: args.filterQuery,
          pageSize: args.pageSize,
          cursor: args.cursor,
        });

        return {
          content: [
            {
              type: "text",
              text: stringifyMcpPayload(hubs),
            },
          ],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[AEC Error] ${message}`);

        return {
          isError: true,
          content: [
            { type: "text", text: `Error al obtener hubs: ${message}` },
          ],
        };
      }
    }
  );
}
