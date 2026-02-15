import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAccAccessToken,
  fetchAllPages,
  buildMcpResponse,
  type PaginatedResponse,
  stringifyMcpPayload
} from "@tad/shared";
import { getAccountProjects } from "../acc/account-admin.client.js";
import { AccountAdminPaginationInputSchema } from "../schemas/pagination.js";
import {
  resolveAccountId,
  parseAccountAdminPage,
  finalizePayload
} from "./_helpers.js";

type ProjectResult = Record<string, unknown>;
type ProjectPage = PaginatedResponse<ProjectResult> & {
  schemaWarning?: string;
};

const Input = z.object({
  accountId: z
    .string()
    .optional()
    .describe("Account ID directo (con o sin prefijo b.)."),
  hubId: z
    .string()
    .optional()
    .describe("Hub ID para derivar accountId (removiendo prefijo b.)."),
  region: z
    .enum(["US", "EMEA", "AUS", "CAN", "DEU", "IND", "JPN", "GBR"])
    .optional()
    .describe("Region opcional para enrutar la peticion."),
  projectName: z
    .string()
    .optional()
    .describe("Filtro por nombre de proyecto (filter[name])."),
  projectStatus: z
    .string()
    .optional()
    .describe("Filtro por estado (filter[status])."),
  projectPlatform: z
    .enum(["acc", "bim360"])
    .optional()
    .describe("Filtro por plataforma (filter[platform])."),
  filterTextMatch: z
    .enum(["contains", "startsWith", "endsWith", "equals"])
    .optional()
    .describe("Modo de matching para filtros de texto."),
  fields: z
    .string()
    .optional()
    .describe("Campos a retornar separados por coma."),
  ...AccountAdminPaginationInputSchema
});

type InputArgs = z.infer<typeof Input>;

export function registerAccProjectGet(server: McpServer) {
  server.registerTool(
    "acc_project_get",
    {
      title: "ACC Project.Get",
      description:
        "Lista proyectos del account usando Construction Admin (accountId derivado de hubId/env).",
      inputSchema: Input.shape
    },
    async (args: InputArgs) => {
      const token = await getAccAccessToken();
      const account = resolveAccountId({
        accountId: args.accountId,
        hubId: args.hubId
      });

      const data = await fetchAllPages<ProjectPage, ProjectResult>({
        fetchAll: args.fetchAll,
        limit: args.limit,
        offset: args.offset,
        maxPages: args.maxPages,
        maxItems: args.maxItems,
        fetchPage: async ({ limit, offset }) =>
          parseAccountAdminPage(
            await getAccountProjects({
              token,
              accountId: account.accountId,
              region: args.region,
              limit,
              offset,
              query: {
                "filter[name]": args.projectName,
                "filter[status]": args.projectStatus,
                "filter[platform]": args.projectPlatform,
                filterTextMatch: args.filterTextMatch,
                fields: args.fields
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
          source: "acc_project_get"
        });
      }

      const payload = finalizePayload(
        "acc_project_get",
        buildMcpResponse({
          results: Array.isArray(data.results) ? data.results : [],
          pagination:
            data.pagination && typeof data.pagination === "object"
              ? (data.pagination as Record<string, unknown>)
              : {
                  limit: args.limit,
                  offset: args.offset,
                  totalResults: Array.isArray(data.results) ? data.results.length : 0,
                  returned: Array.isArray(data.results) ? data.results.length : 0,
                  hasMore: false,
                  nextOffset: null
                },
          meta: {
            tool: "acc_project_get",
            generatedAt: new Date().toISOString(),
            source: "construction/admin/v1/accounts/:accountId/projects",
            accountResolution: account,
            options: {
              fetchAll: args.fetchAll,
              limit: args.limit,
              offset: args.offset,
              maxPages: args.maxPages,
              maxItems: args.maxItems,
              region: args.region,
              projectName: args.projectName,
              projectStatus: args.projectStatus,
              projectPlatform: args.projectPlatform,
              filterTextMatch: args.filterTextMatch,
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
