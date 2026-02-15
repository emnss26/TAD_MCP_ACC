import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stringifyMcpPayload } from "@tad/shared";
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

        const elements = await getAecElementsByProject(projectId, {
          filterQuery: args.filterQuery,
          pageSize: args.pageSize,
          cursor: args.cursor,
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
              text: `Error al obtener elementos del proyecto: ${message}`,
            },
          ],
        };
      }
    }
  );
}
