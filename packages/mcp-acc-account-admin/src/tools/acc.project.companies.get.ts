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
import { getProjectCompaniesByAccount } from "../acc/account-admin.client.js";
import { AccountAdminPaginationInputSchema } from "../schemas/pagination.js";
import {
  resolveAccountId,
  parseAccountAdminPage,
  finalizePayload
} from "./_helpers.js";

type ProjectCompanyResult = Record<string, unknown>;
type ProjectCompanyPage = PaginatedResponse<ProjectCompanyResult> & {
  schemaWarning?: string;
};

const Input = z
  .object({
    accountId: z
      .string()
      .optional()
      .describe("Account ID directo (con o sin prefijo b.)."),
    hubId: z
      .string()
      .optional()
      .describe("Hub ID para derivar accountId y/o resolver projectName."),
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
    sort: z.string().optional().describe("Ordenamiento."),
    field: z.string().optional().describe("Campos a incluir en respuesta."),
    ...AccountAdminPaginationInputSchema
  })
  .refine((value) => Boolean(value.projectId || value.projectName), {
    message: "Debes enviar projectId o projectName para identificar el proyecto.",
    path: ["projectId"]
  });

type InputArgs = z.infer<typeof Input>;

export function registerAccProjectCompaniesGet(server: McpServer) {
  server.registerTool(
    "acc_project_companies_get",
    {
      title: "ACC Project.Companies.Get",
      description:
        "Lista companias de un proyecto (HQ endpoint) resolviendo projectId por nombre cuando sea necesario.",
      inputSchema: Input.shape
    },
    async (args: InputArgs) => {
      const token = await getAccAccessToken();
      const offset = parseOffsetCursor(args.cursor) ?? args.offset;
      const fetchAll = args.view === "full" ? args.fetchAll : false;
      const account = resolveAccountId({
        accountId: args.accountId,
        hubId: args.hubId
      });

      const resolvedProject = await resolveProject({
        projectId: args.projectId,
        projectName: args.projectName,
        hubId: args.hubId,
        envHubId: process.env.APS_HUB_ID,
        normalizeProjectId: normalizeProjectIdForConstruction
      });

      const data = await fetchAllPages<ProjectCompanyPage, ProjectCompanyResult>({
        fetchAll,
        limit: args.limit,
        offset,
        maxPages: args.maxPages,
        maxItems: args.maxItems,
        fetchPage: async ({ limit, offset }) =>
          parseAccountAdminPage(
            await getProjectCompaniesByAccount({
              token,
              accountId: account.accountId,
              projectId: resolvedProject.projectId,
              region: args.region,
              limit,
              offset,
              query: {
                sort: args.sort,
                field: args.field
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
          source: "acc_project_companies_get"
        });
      }

      const payload = finalizePayload(
        "acc_project_companies_get",
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
            tool: "acc_project_companies_get",
            generatedAt: new Date().toISOString(),
            source: "hq/v1/accounts/:account_id/projects/:project_id/companies",
            accountResolution: account,
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
              sort: args.sort,
              field: args.field
            }
          },
          warnings
        }) as Record<string, unknown>
      );

      return { content: [{ type: "text", text: stringifyMcpPayload(payload) }] };
    }
  );
}
