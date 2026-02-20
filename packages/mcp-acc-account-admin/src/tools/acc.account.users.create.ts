import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getAccAccessToken,
  buildMcpResponse,
  stringifyMcpPayload
} from "@tad/shared";
import { createAccountUser } from "../acc/account-admin.client.js";
import { AccountUsersCreateInputSchema } from "../schemas/account-admin.js";
import { resolveAccountId, finalizePayload } from "./_helpers.js";

type InputArgs = {
  accountId?: string;
  hubId?: string;
  region?: "US" | "EMEA" | "AUS" | "CAN" | "DEU" | "IND" | "JPN" | "GBR";
  payload: Record<string, unknown>;
};

export function registerAccAccountUsersCreate(server: McpServer) {
  server.registerTool(
    "acc_account_users_create",
    {
      title: "ACC Account.Users.Create",
      description: "Crea un usuario de account via HQ endpoint.",
      inputSchema: AccountUsersCreateInputSchema.shape
    },
    async (args: InputArgs) => {
      const account = resolveAccountId({
        accountId: args.accountId,
        hubId: args.hubId
      });

      const token = await getAccAccessToken();
      const created = await createAccountUser({
        token,
        accountId: account.accountId,
        payload: args.payload,
        region: args.region
      });

      const output = finalizePayload(
        "acc_account_users_create",
        buildMcpResponse({
          results: [created as Record<string, unknown>],
          pagination: {
            totalResults: 1,
            returned: 1,
            offset: 0,
            hasMore: false,
            nextOffset: null
          },
          meta: {
            tool: "acc_account_users_create",
            generatedAt: new Date().toISOString(),
            source: "hq/v1/accounts/:account_id/users",
            accountResolution: account
          }
        }) as Record<string, unknown>
      );

      return {
        content: [{ type: "text", text: stringifyMcpPayload(output) }]
      };
    }
  );
}
