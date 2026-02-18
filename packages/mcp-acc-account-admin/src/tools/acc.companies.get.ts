import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAccAccessToken,
  fetchAllPages,
  buildMcpResponse,
  parseOffsetCursor,
  type PaginatedResponse,
  stringifyMcpPayload
} from "@tad/shared";
import { getAccountCompanies } from "../acc/account-admin.client.js";
import { AccountAdminPaginationInputSchema } from "../schemas/pagination.js";
import {
  resolveAccountId,
  parseAccountAdminPage,
  finalizePayload
} from "./_helpers.js";

type CompanyResult = Record<string, unknown>;
type CompanyPage = PaginatedResponse<CompanyResult> & {
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
  companyName: z
    .string()
    .optional()
    .describe("Filtro por nombre de compania (filter[name])."),
  trade: z
    .string()
    .optional()
    .describe("Filtro por trade (filter[trade])."),
  erpId: z
    .string()
    .optional()
    .describe("Filtro por ERP ID (filter[erpId])."),
  taxId: z
    .string()
    .optional()
    .describe("Filtro por Tax ID (filter[taxId])."),
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

export function registerAccCompaniesGet(server: McpServer) {
  server.registerTool(
    "acc_companies_get",
    {
      title: "ACC Companies.Get",
      description:
        "Lista companias del account usando Construction Admin (accountId derivado de hubId/env).",
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

      const data = await fetchAllPages<CompanyPage, CompanyResult>({
        fetchAll,
        limit: args.limit,
        offset,
        maxPages: args.maxPages,
        maxItems: args.maxItems,
        fetchPage: async ({ limit, offset }) =>
          parseAccountAdminPage(
            await getAccountCompanies({
              token,
              accountId: account.accountId,
              region: args.region,
              limit,
              offset,
              query: {
                "filter[name]": args.companyName,
                "filter[trade]": args.trade,
                "filter[erpId]": args.erpId,
                "filter[taxId]": args.taxId,
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
          source: "acc_companies_get"
        });
      }

      const payload = finalizePayload(
        "acc_companies_get",
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
            tool: "acc_companies_get",
            generatedAt: new Date().toISOString(),
            source: "construction/admin/v1/accounts/:accountId/companies",
            accountResolution: account,
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
              companyName: args.companyName,
              trade: args.trade,
              erpId: args.erpId,
              taxId: args.taxId,
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
