import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAccAccessToken,
  fetchAllPages,
  resolveProject,
  normalizeProjectIdForConstruction,
  buildMcpResponse,
  parseOffsetCursor,
  type PaginatedResponse,
  stringifyMcpPayload
} from "@tad/shared";
import { getProjectUsers } from "../acc/account-admin.client.js";
import { AccountAdminPaginationInputSchema } from "../schemas/pagination.js";
import { parseAccountAdminPage, finalizePayload } from "./_helpers.js";

type ProjectUserResult = Record<string, unknown>;
type ProjectUserPage = PaginatedResponse<ProjectUserResult> & {
  schemaWarning?: string;
};

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
    name: z.string().optional().describe("Filtro por nombre de usuario."),
    email: z.string().optional().describe("Filtro por email."),
    status: z.string().optional().describe("Filtro por status."),
    companyId: z.string().optional().describe("Filtro por company ID."),
    autodeskId: z.string().optional().describe("Filtro por Autodesk ID."),
    accessLevels: z.string().optional().describe("Filtro por access levels."),
    sort: z.string().optional().describe("Ordenamiento."),
    fields: z.string().optional().describe("Campos a incluir en respuesta."),
    filterTextMatch: z
      .enum(["contains", "startsWith", "endsWith", "equals"])
      .optional()
      .describe("Modo de matching para filtros de texto."),
    ...AccountAdminPaginationInputSchema
  })
  .refine((value) => Boolean(value.projectId || value.projectName), {
    message: "Debes enviar projectId o projectName para identificar el proyecto.",
    path: ["projectId"]
  });

type InputArgs = z.infer<typeof Input>;

export function registerAccProjectUsersGet(server: McpServer) {
  server.registerTool(
    "acc_project_users_get",
    {
      title: "ACC Project.Users.Get",
      description:
        "Lista usuarios del proyecto con Construction Admin resolviendo projectId por nombre cuando sea necesario.",
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

      const data = await fetchAllPages<ProjectUserPage, ProjectUserResult>({
        fetchAll,
        limit: args.limit,
        offset,
        maxPages: args.maxPages,
        maxItems: args.maxItems,
        fetchPage: async ({ limit, offset }) =>
          parseAccountAdminPage(
            await getProjectUsers({
              token,
              projectId: resolvedProject.projectId,
              region: args.region,
              limit,
              offset,
              query: {
                "filter[name]": args.name,
                "filter[email]": args.email,
                "filter[status]": args.status,
                "filter[companyId]": args.companyId,
                "filter[autodeskId]": args.autodeskId,
                "filter[accessLevels]": args.accessLevels,
                sort: args.sort,
                fields: args.fields,
                filterTextMatch: args.filterTextMatch
              }
            }),
            { limit, offset }
          )
      });

      const warnings: Array<{ code: string; message: string; source: string }> = [];
      if (data.schemaWarning) {
        warnings.push({
          code: "account_admin_schema_warning",
          message: data.schemaWarning,
          source: "acc_project_users_get"
        });
      }

      const payload = finalizePayload(
        "acc_project_users_get",
        buildMcpResponse({
          results: Array.isArray(data.results) ? data.results : [],
          pagination:
            data.pagination && typeof data.pagination === "object"
              ? (data.pagination as Record<string, unknown>)
              : {
                  limit: args.limit,
                  offset,
                  totalResults: Array.isArray(data.results) ? data.results.length : 0,
                  returned: Array.isArray(data.results) ? data.results.length : 0,
                  hasMore: false,
                  nextOffset: null
                },
          meta: {
            tool: "acc_project_users_get",
            generatedAt: new Date().toISOString(),
            source: "construction/admin/v1/projects/:projectId/users",
            projectResolution: {
              source: resolvedProject.source,
              hubId: resolvedProject.hubId,
              requestedProjectName: resolvedProject.requestedProjectName,
              resolvedProjectName: resolvedProject.resolvedProjectName,
              rawProjectId: resolvedProject.rawProjectId,
              accountAdminProjectId: resolvedProject.projectId
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
              region: args.region,
              name: args.name,
              email: args.email,
              status: args.status,
              companyId: args.companyId,
              autodeskId: args.autodeskId,
              accessLevels: args.accessLevels,
              sort: args.sort,
              fields: args.fields,
              filterTextMatch: args.filterTextMatch
            }
          },
          warnings
        }) as Record<string, unknown>
      );

      return { content: [{ type: "text", text: stringifyMcpPayload(payload) }] };
    }
  );
}
