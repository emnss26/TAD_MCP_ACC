import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  buildMcpResponse,
  clampListLimit,
  parseOffsetCursor,
  stringifyMcpPayload
} from "@tad/shared";
import { AecElementQuerySchema } from "../schemas/aec.js";
import {
  getAecElementsByProject
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
        const gqlProjectId = String(args.projectId ?? "").trim();
        if (!gqlProjectId) {
          throw new Error("projectId es requerido.");
        }

        const limit = clampListLimit(args.limit ?? args.pageSize);
        const offset = parseOffsetCursor(args.cursor) ?? 0;

        const filterQuery = args.category
          ? `property.name.category == '${args.category}'`
          : undefined;

        const elements = await getAecElementsByProject(gqlProjectId, {
          filterQuery,
          
          cursor: args.cursor,
        });

        const hasMore = elements.length === limit;
        const payload = buildMcpResponse({
          results: elements,
          pagination: {
            limit,
            offset,
            totalResults: elements.length,
            returned: elements.length,
            hasMore,
            nextOffset: hasMore ? offset + elements.length : null
          },
          meta: {
            tool: "aec_get_quantities",
            generatedAt: new Date().toISOString(),
            source: "aec/graphql/elementsByProject",
            options: {
              projectId: gqlProjectId,
              gqlProjectId,
              category: args.category,
              limit,
              offset,
              cursor: args.cursor,
              view: args.view,
              outputFields: args.outputFields
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
