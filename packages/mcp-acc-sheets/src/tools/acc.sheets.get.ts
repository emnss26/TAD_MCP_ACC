import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAccAccessToken,
  fetchAllPages,
  resolveProject,
  normalizeProjectIdForConstruction,
  buildMcpResponse,
  parseOffsetCursor,
  stringifyMcpPayload
} from "@tad/shared";
import { listSheets } from "../acc/sheets.client.js";
import { SheetsPaginationInputSchema } from "../schemas/pagination.js";
import { parseSheetsPage, finalizePayload, type SheetsPage } from "./_helpers.js";

const QueryValueSchema = z.union([z.string(), z.number(), z.boolean()]);

const Input = z
  .object({
    hubId: z
      .string()
      .optional()
      .describe("Hub ID para resolver projectName. Si se omite, usa APS_HUB_ID."),
    projectId: z
      .string()
      .optional()
      .describe("Project ID directo (con o sin prefijo b.)."),
    projectName: z
      .string()
      .optional()
      .describe("Nombre del proyecto para resolver projectId via hub."),
    sort: z.string().optional().describe("Ordenamiento."),
    fields: z.string().optional().describe("Campos a incluir en la respuesta."),
    query: z
      .record(z.string(), QueryValueSchema)
      .optional()
      .describe("Parametros de query adicionales para el endpoint."),
    ...SheetsPaginationInputSchema
  })
  .refine((value) => Boolean(value.projectId || value.projectName), {
    message: "Debes enviar projectId o projectName para identificar el proyecto.",
    path: ["projectId"]
  });

type InputArgs = z.infer<typeof Input>;

export function registerAccSheetsGet(server: McpServer) {
  server.registerTool(
    "acc_sheets_get",
    {
      title: "ACC Sheets - List Sheets",
      description:
        "Lista sheets de un proyecto en Construction Sheets v1.",
      inputSchema: Input.shape
    },
    async (args: InputArgs) => {
      const token = await getAccAccessToken();
      const offset = parseOffsetCursor(args.cursor) ?? args.offset;
      const fetchAll = args.view === "full" ? args.fetchAll : false;

      const resolvedProject = await resolveProject({
        projectId: args.projectId,
        projectName: args.projectName,
        hubId: args.hubId,
        envHubId: process.env.APS_HUB_ID,
        normalizeProjectId: normalizeProjectIdForConstruction
      });

      const page = await fetchAllPages<SheetsPage, Record<string, unknown>>({
        fetchAll,
        limit: args.limit,
        offset,
        maxPages: args.maxPages,
        maxItems: args.maxItems,
        fetchPage: async ({ limit, offset }) =>
          parseSheetsPage(
            await listSheets({
              token,
              projectId: resolvedProject.projectId,
              limit,
              offset,
              query: {
                ...(args.query ?? {}),
                sort: args.sort,
                fields: args.fields
              }
            }),
            { limit, offset }
          )
      });

      const warnings: Array<{ code: string; message: string; source: string }> = [];
      if (page.schemaWarning) {
        warnings.push({
          code: "sheets_schema_warning",
          message: page.schemaWarning,
          source: "acc_sheets_get"
        });
      }

      const payload = finalizePayload(
        "acc_sheets_get",
        buildMcpResponse({
          results: Array.isArray(page.results) ? page.results : [],
          pagination:
            page.pagination && typeof page.pagination === "object"
              ? (page.pagination as Record<string, unknown>)
              : {
                  limit: args.limit,
                  offset,
                  totalResults: Array.isArray(page.results) ? page.results.length : 0,
                  returned: Array.isArray(page.results) ? page.results.length : 0,
                  hasMore: false,
                  nextOffset: null
                },
          meta: {
            tool: "acc_sheets_get",
            generatedAt: new Date().toISOString(),
            source: "construction/sheets/v1/projects/{projectId}/sheets",
            projectResolution: {
              source: resolvedProject.source,
              hubId: resolvedProject.hubId,
              requestedProjectName: resolvedProject.requestedProjectName,
              resolvedProjectName: resolvedProject.resolvedProjectName,
              rawProjectId: resolvedProject.rawProjectId,
              sheetsProjectId: resolvedProject.projectId
            },
            options: {
              fetchAll,
              limit: args.limit,
              offset,
              cursor: args.cursor,
              view: args.view,
              outputFields: args.outputFields,
              maxPages: args.maxPages,
              maxItems: args.maxItems,
              sort: args.sort,
              fields: args.fields,
              query: args.query
            }
          },
          warnings
        }) as Record<string, unknown>
      );

      return { content: [{ type: "text", text: stringifyMcpPayload(payload) }] };
    }
  );
}
