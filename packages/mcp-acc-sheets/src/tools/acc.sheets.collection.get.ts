import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAccAccessToken,
  resolveProject,
  normalizeProjectIdForConstruction,
  buildMcpResponse,
  stringifyMcpPayload
} from "@tad/shared";
import { getCollection } from "../acc/sheets.client.js";
import { parseSheetsPage, finalizePayload } from "./_helpers.js";

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
    collectionId: z.string().min(1).describe("ID de la coleccion."),
    query: z
      .record(z.string(), QueryValueSchema)
      .optional()
      .describe("Parametros de query adicionales para el endpoint.")
  })
  .refine((value) => Boolean(value.projectId || value.projectName), {
    message: "Debes enviar projectId o projectName para identificar el proyecto.",
    path: ["projectId"]
  });

type InputArgs = z.infer<typeof Input>;

export function registerAccSheetsCollectionGet(server: McpServer) {
  server.registerTool(
    "acc_sheets_collection_get",
    {
      title: "ACC Sheets - Collection",
      description:
        "Obtiene una coleccion especifica de Sheets por collectionId.",
      inputSchema: Input.shape
    },
    async (args: InputArgs) => {
      const token = await getAccAccessToken();

      const resolvedProject = await resolveProject({
        projectId: args.projectId,
        projectName: args.projectName,
        hubId: args.hubId,
        envHubId: process.env.APS_HUB_ID,
        normalizeProjectId: normalizeProjectIdForConstruction
      });

      const raw = await getCollection({
        token,
        projectId: resolvedProject.projectId,
        collectionId: args.collectionId,
        query: args.query
      });

      const page = parseSheetsPage(raw, { limit: 1, offset: 0 });
      const warnings: Array<{ code: string; message: string; source: string }> = [];
      if (page.schemaWarning) {
        warnings.push({
          code: "sheets_schema_warning",
          message: page.schemaWarning,
          source: "acc_sheets_collection_get"
        });
      }

      const payload = finalizePayload(
        "acc_sheets_collection_get",
        buildMcpResponse({
          results: Array.isArray(page.results) ? page.results : [],
          pagination: {
            totalResults: Array.isArray(page.results) ? page.results.length : 0,
            returned: Array.isArray(page.results) ? page.results.length : 0,
            offset: 0,
            hasMore: false,
            nextOffset: null
          },
          meta: {
            tool: "acc_sheets_collection_get",
            generatedAt: new Date().toISOString(),
            source:
              "construction/sheets/v1/projects/{projectId}/collections/{collectionId}",
            projectResolution: {
              source: resolvedProject.source,
              hubId: resolvedProject.hubId,
              requestedProjectName: resolvedProject.requestedProjectName,
              resolvedProjectName: resolvedProject.resolvedProjectName,
              rawProjectId: resolvedProject.rawProjectId,
              sheetsProjectId: resolvedProject.projectId
            },
            options: {
              collectionId: args.collectionId,
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
