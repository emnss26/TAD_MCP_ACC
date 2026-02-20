import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAccAccessToken,
  buildMcpResponse,
  stringifyMcpPayload
} from "@tad/shared";
import { getAccountUser } from "../acc/account-admin.client.js";
import { resolveAccountId, parseAccountAdminPage, finalizePayload } from "./_helpers.js";

const Input = z.object({
  accountId: z
    .string()
    .optional()
    .describe("Account ID directo (con o sin prefijo b.)."),
  hubId: z
    .string()
    .optional()
    .describe("Hub ID para derivar accountId (removiendo prefijo b.)."),
  userId: z.string().min(1).describe("ID del usuario a consultar."),
  region: z
    .enum(["US", "EMEA", "AUS", "CAN", "DEU", "IND", "JPN", "GBR"])
    .optional()
    .describe("Region opcional para enrutar la peticion."),
  field: z.string().optional().describe("Campos a incluir en respuesta.")
});

type InputArgs = z.infer<typeof Input>;

export function registerBim360UserGet(server: McpServer) {
  server.registerTool(
    "bim360_user_get",
    {
      title: "BIM 360 User.Get",
      description:
        "Obtiene un usuario especifico del account usando HQ v1.",
      inputSchema: Input.shape
    },
    async (args: InputArgs) => {
      const token = await getAccAccessToken();
      const account = resolveAccountId({
        accountId: args.accountId,
        hubId: args.hubId
      });

      const raw = await getAccountUser({
        token,
        accountId: account.accountId,
        userId: args.userId,
        region: args.region,
        query: {
          field: args.field
        }
      });

      const page = parseAccountAdminPage(raw, { limit: 1, offset: 0 });
      const warnings: Array<{ code: string; message: string; source: string }> = [];
      if (page.schemaWarning) {
        warnings.push({
          code: "account_admin_schema_warning",
          message: page.schemaWarning,
          source: "bim360_user_get"
        });
      }

      const payload = finalizePayload(
        "bim360_user_get",
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
            tool: "bim360_user_get",
            generatedAt: new Date().toISOString(),
            source: "hq/v1/accounts/:account_id/users/:user_id",
            accountResolution: account,
            options: {
              userId: args.userId,
              region: args.region,
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
