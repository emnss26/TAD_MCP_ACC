import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildMcpResponse,
  parseOffsetCursor,
  stringifyMcpPayload
} from "@tad/shared";
import { HubIdSchema } from "../schemas/dm.js";
import { DmPaginationSchema } from "../schemas/pagination.js";
import { getHubProjects } from "../dm/dm.client.js";

const Input = z.object({
  ...HubIdSchema.shape,
  ...DmPaginationSchema
});

export function registerGetProjects(server: McpServer) {
  server.registerTool(
    "dm_get_projects",
    {
      title: "Data Management - List Projects",
      description: "Lista todos los proyectos en un Hub para encontrar sus IDs.",
      inputSchema: Input.shape
    },
    async (args) => {
      const hubId = args.hubId || process.env.APS_HUB_ID;
      if (!hubId) throw new Error("Falta APS_HUB_ID en las variables de entorno.");

      const projects = await getHubProjects(hubId);
      const start = parseOffsetCursor(args.cursor) ?? args.offset ?? 0;
      const end = start + args.limit;
      const page = projects.slice(start, end);
      const hasMore = end < projects.length;

      const results = page.map((project: any) => ({
        id: project.id,
        name: project?.attributes?.name ?? null,
        projectType: project?.attributes?.extension?.data?.projectType ?? null,
        projectStatus: project?.attributes?.extension?.data?.projectStatus ?? null
      }));

      const warnings: Array<{ code: string; message: string; source: string }> = [];
      if (projects.length === 0) {
        warnings.push({
          code: "no_projects",
          message: `No se encontraron proyectos para el hub '${hubId}'.`,
          source: "dm_get_projects"
        });
      } else if (results.length === 0) {
        warnings.push({
          code: "empty_page",
          message: `No hay resultados en la pagina solicitada (offset=${start}).`,
          source: "dm_get_projects"
        });
      }

      const payload = buildMcpResponse({
        results,
        pagination: {
          offset: start,
          limit: args.limit,
          totalResults: projects.length,
          returned: results.length,
          hasMore,
          nextOffset: hasMore ? start + results.length : null
        },
        meta: {
          tool: "dm_get_projects",
          generatedAt: new Date().toISOString(),
          source: "project.v1/hubs/:hubId/projects",
          hubId,
          options: {
            limit: args.limit,
            offset: start,
            cursor: args.cursor,
            view: args.view,
            outputFields: args.outputFields
          }
        },
        warnings
      });

      return {
        content: [{ type: "text", text: stringifyMcpPayload(payload) }]
      };
    }
  );
}
