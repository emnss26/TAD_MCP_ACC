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
import { getAccountUsers } from "../acc/account-admin.client.js";
import { AccountAdminPaginationInputSchema } from "../schemas/pagination.js";
import {
  resolveAccountId,
  parseAccountAdminPage,
  finalizePayload
} from "./_helpers.js";

type UserResult = Record<string, unknown>;
type UserPage = PaginatedResponse<UserResult> & {
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
  name: z.string().optional().describe("Filtro por nombre de usuario."),
  email: z.string().optional().describe("Filtro por correo."),
  companyName: z
    .string()
    .optional()
    .describe("Filtro por nombre de compania."),
  operator: z
    .enum(["OR", "AND"])
    .optional()
    .describe("Operador booleano para filtros."),
  partial: z
    .boolean()
    .optional()
    .describe("Si true (default API), usa match parcial."),
  sort: z.string().optional().describe("Ordenamiento."),
  field: z.string().optional().describe("Campos a incluir en respuesta."),
  ...AccountAdminPaginationInputSchema
});

type InputArgs = z.infer<typeof Input>;

export function registerBim360AccountUsersGet(server: McpServer) {
  server.registerTool(
    "bim360_account_users_get",
    {
      title: "BIM 360 Account.Users.Get",
      description:
        "Lista usuarios del account (HQ endpoint) usando accountId derivado de hubId/env para BIM 360.",
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

      const data = await fetchAllPages<UserPage, UserResult>({
        fetchAll,
        limit: args.limit,
        offset,
        maxPages: args.maxPages,
        maxItems: args.maxItems,
        fetchPage: async ({ limit, offset }) =>
          parseAccountAdminPage(
            await getAccountUsers({
              token,
              accountId: account.accountId,
              region: args.region,
              limit,
              offset,
              query: {
                name: args.name,
                email: args.email,
                company_name: args.companyName,
                operator: args.operator,
                partial: args.partial,
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
          source: "bim360_account_users_get"
        });
      }

      const payload = finalizePayload(
        "bim360_account_users_get",
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
            tool: "bim360_account_users_get",
            generatedAt: new Date().toISOString(),
            source: "hq/v1/accounts/:account_id/users",
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
              name: args.name,
              email: args.email,
              companyName: args.companyName,
              operator: args.operator,
              partial: args.partial,
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
