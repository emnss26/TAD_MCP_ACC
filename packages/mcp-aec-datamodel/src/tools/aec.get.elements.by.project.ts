import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  buildMcpResponse,
  clampListLimit,
  parseOffsetCursor,
  stringifyMcpPayload
} from "@tad/shared";
import { AecElementsByProjectQuerySchema } from "../schemas/aec.js";
import { getAecElementsByProject } from "../aec/aec.client.js";

export function registerAecElementsByProject(server: McpServer) {
  server.registerTool(
    "aec_get_elements_by_project",
    {
      title: "AEC Data Model - Elements By Project",
      description:
        "Lista elementos/modelos de un proyecto para aplicar filtros y cuantificacion.",
      inputSchema: AecElementsByProjectQuerySchema.shape,
    },
    async (args) => {
      try {
        const projectId = String(args?.projectId ?? "").trim();
        if (!projectId) {
          throw new Error("projectId es requerido.");
        }

        const limit = clampListLimit(args.limit ?? args.pageSize);
        const offset = parseOffsetCursor(args.cursor) ?? 0;

        const elements = await getAecElementsByProject(projectId, {
          filterQuery: args.filterQuery,
          
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
            tool: "aec_get_elements_by_project",
            generatedAt: new Date().toISOString(),
            source: "aec/graphql/elementsByProject",
            options: {
              projectId,
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
            {
              type: "text",
              text: `Error al obtener elementos del proyecto: ${message}`,
            },
          ],
        };
      }
    }
  );
}
