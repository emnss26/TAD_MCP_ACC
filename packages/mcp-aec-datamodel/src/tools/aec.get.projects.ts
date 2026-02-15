import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stringifyMcpPayload } from "@tad/shared";
import { AecProjectsQuerySchema } from "../schemas/aec.js";
import { getAecProjects } from "../aec/aec.client.js";

export function registerAecProjects(server: McpServer) {
  server.registerTool(
    "aec_get_projects",
    {
      title: "AEC Data Model - List Projects",
      description:
        "Lista proyectos por hub. Acepta hubId b.xxx (Data Management) o hubId GraphQL AEC.",
      inputSchema: AecProjectsQuerySchema.shape,
    },
    async (args) => {
      try {
        const hubId = String(args?.hubId ?? "").trim();
        if (!hubId) {
          throw new Error("hubId es requerido.");
        }

        const projects = await getAecProjects(hubId, {
          filterQuery: args.filterQuery,
          pageSize: args.pageSize,
          cursor: args.cursor,
        });

        return {
          content: [
            {
              type: "text",
              text: stringifyMcpPayload(projects),
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
              text: `Error al obtener proyectos: ${message}`,
            },
          ],
        };
      }
    }
  );
}
