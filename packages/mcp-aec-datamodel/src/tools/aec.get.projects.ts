import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  buildMcpResponse,
  clampListLimit,
  parseOffsetCursor,
  stringifyMcpPayload
} from "@tad/shared";
import { AecProjectsQuerySchema } from "../schemas/aec.js";
import { getAecProjects, getConfiguredAecHubId } from "../aec/aec.client.js";

export function registerAecProjects(server: McpServer) {
  server.registerTool(
    "aec_get_projects",
    {
      title: "AEC Data Model - List Projects",
      description:
        "Lista proyectos por hub AEC GraphQL (urn:...). Si se omite, usa APS_HUB_AEC_ID.",
      inputSchema: AecProjectsQuerySchema.shape,
    },
    async (args) => {
      try {
        const inputHubId = String(args?.hubId ?? "").trim();
        const hubId = inputHubId || getConfiguredAecHubId();
        if (!hubId) {
          throw new Error(
            "hubId es requerido. Envia hubId o configura APS_HUB_AEC_ID (fallback: APS_HUB_ID)."
          );
        }

        const limit = clampListLimit(args.limit ?? args.pageSize);
        const offset = parseOffsetCursor(args.cursor) ?? 0;

        const projects = await getAecProjects(hubId, {
          cursor: args.cursor,
        });

        const hasMore = projects.length === limit;
        const payload = buildMcpResponse({
          results: projects,
          pagination: {
            limit,
            offset,
            totalResults: projects.length,
            returned: projects.length,
            hasMore,
            nextOffset: hasMore ? offset + projects.length : null
          },
          meta: {
            tool: "aec_get_projects",
            generatedAt: new Date().toISOString(),
            source: "aec/graphql/projects",
            options: {
              hubId,
              inputHubId: inputHubId || null,
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
              text: `Error al obtener proyectos: ${message}`,
            },
          ],
        };
      }
    }
  );
}
