import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAccAccessToken,
  resolveProject,
  normalizeProjectIdForConstruction,
  buildMcpResponse,
  stringifyMcpPayload
} from "@tad/shared";
import { getProject } from "../acc/account-admin.client.js";
import { parseAccountAdminPage, finalizePayload } from "./_helpers.js";

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
    region: z
      .enum(["US", "EMEA", "AUS", "CAN", "DEU", "IND", "JPN", "GBR"])
      .optional()
      .describe("Region opcional para enrutar la peticion."),
    fields: z
      .string()
      .optional()
      .describe("Campos a incluir en respuesta (si el endpoint lo soporta).")
  })
  .refine((value) => Boolean(value.projectId || value.projectName), {
    message: "Debes enviar projectId o projectName para identificar el proyecto.",
    path: ["projectId"]
  });

type InputArgs = z.infer<typeof Input>;

export function registerBim360ProjectGet(server: McpServer) {
  server.registerTool(
    "bim360_project_get",
    {
      title: "BIM 360 Project.Get",
      description:
        "Obtiene un proyecto de Construction Admin usando projectId o projectName.",
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

      const raw = await getProject({
        token,
        projectId: resolvedProject.projectId,
        region: args.region,
        query: {
          fields: args.fields
        }
      });

      const page = parseAccountAdminPage(raw, { limit: 1, offset: 0 });
      const warnings: Array<{ code: string; message: string; source: string }> = [];
      if (page.schemaWarning) {
        warnings.push({
          code: "account_admin_schema_warning",
          message: page.schemaWarning,
          source: "bim360_project_get"
        });
      }

      const payload = finalizePayload(
        "bim360_project_get",
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
            tool: "bim360_project_get",
            generatedAt: new Date().toISOString(),
            source: "construction/admin/v1/projects/:projectId",
            projectResolution: {
              source: resolvedProject.source,
              hubId: resolvedProject.hubId,
              requestedProjectName: resolvedProject.requestedProjectName,
              resolvedProjectName: resolvedProject.resolvedProjectName,
              rawProjectId: resolvedProject.rawProjectId,
              accountAdminProjectId: resolvedProject.projectId
            },
            options: {
              region: args.region,
              fields: args.fields
            }
          },
          warnings
        }) as Record<string, unknown>
      );

      return { content: [{ type: "text", text: stringifyMcpPayload(payload) }] };
    }
  );
}
