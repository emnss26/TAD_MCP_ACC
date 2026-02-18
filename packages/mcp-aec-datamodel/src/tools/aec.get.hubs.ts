import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  buildMcpResponse,
  clampListLimit,
  parseOffsetCursor,
  stringifyMcpPayload
} from "@tad/shared";
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
        const limit = clampListLimit(args.limit ?? args.pageSize);
        const offset = parseOffsetCursor(args.cursor) ?? 0;

        const hubs = await getAecHubs({
          filterQuery: args.filterQuery,
          pageSize: limit,
          cursor: args.cursor,
        });

        const hasMore = hubs.length === limit;
        const payload = buildMcpResponse({
          results: hubs,
          pagination: {
            limit,
            offset,
            totalResults: hubs.length,
            returned: hubs.length,
            hasMore,
            nextOffset: hasMore ? offset + hubs.length : null
          },
          meta: {
            tool: "aec_get_hubs",
            generatedAt: new Date().toISOString(),
            source: "aec/graphql/hubs",
            options: {
              limit,
              offset,
              cursor: args.cursor,
              view: args.view,
              outputFields: args.outputFields,
              filterQuery: args.filterQuery
            }
          }
        });

        return {
          content: [
            {
              type: "text",
              text: stringifyMcpPayload(payload),
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
