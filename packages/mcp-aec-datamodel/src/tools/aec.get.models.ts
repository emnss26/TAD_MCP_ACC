import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  buildMcpResponse,
  parseOffsetCursor,
  stringifyMcpPayload
} from "@tad/shared";
import { AecElementsByProjectQuerySchema } from "../schemas/aec.js";
import { getAecElementGroupsByProject } from "../aec/aec.client.js";

export function registerAecModels(server: McpServer) {
  server.registerTool(
    "aec_get_models",
    {
      title: "AEC Data Model - List Models",
      description:
        "Lista los modelos (element groups / archivos RVT, etc.) de un proyecto AEC. Usa el projectId GraphQL.",
      inputSchema: AecElementsByProjectQuerySchema.shape,
    },
    async (args) => {
      try {
        const projectId = String(args?.projectId ?? "").trim();
        if (!projectId) throw new Error("projectId es requerido.");

        const offset = parseOffsetCursor(args.cursor) ?? 0;

        const models = await getAecElementGroupsByProject(projectId, {
          cursor: args.cursor,
        });

        const payload = buildMcpResponse({
          results: models,
          pagination: {
            limit: models.length,
            offset,
            totalResults: models.length,
            returned: models.length,
            hasMore: false,
            nextOffset: null,
          },
          meta: {
            tool: "aec_get_models",
            generatedAt: new Date().toISOString(),
            source: "aec/graphql/elementGroupsByProject",
            options: {
              projectId,
              cursor: args.cursor,
              view: args.view,
              outputFields: args.outputFields,
            },
          },
        });

        return {
          content: [{ type: "text", text: stringifyMcpPayload(payload) }],
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[AEC Error] ${message}`);
        return {
          isError: true,
          content: [{ type: "text", text: `Error al obtener modelos: ${message}` }],
        };
      }
    }
  );
}