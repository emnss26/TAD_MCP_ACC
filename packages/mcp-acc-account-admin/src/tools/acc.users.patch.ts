import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAccAccessToken, buildMcpResponse,
  stringifyMcpPayload
} from "@tad/shared";
import { patchUserDetails } from "../acc/account-admin.client.js";
import { UsersPatchInputSchema } from "../schemas/account-admin.js";
import { resolveAccountId, finalizePayload } from "./_helpers.js";

type InputArgs = {
  accountId?: string;
  hubId?: string;
  region?: "US" | "EMEA" | "AUS" | "CAN" | "DEU" | "IND" | "JPN" | "GBR";
  userId: string;
  changes: Record<string, unknown>;
  additionalPayload?: Record<string, unknown>;
  confirm: boolean;
};

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T;
}

export function registerAccUsersPatch(server: McpServer) {
  server.registerTool(
    "acc_users_patch",
    {
      title: "ACC Users.Patch",
      description:
        "Actualiza status/company de un usuario en Account Admin (requiere confirm=true como doble check).",
      inputSchema: UsersPatchInputSchema.shape
    },
    async (args: InputArgs) => {
      const account = resolveAccountId({
        accountId: args.accountId,
        hubId: args.hubId
      });

      const patchPayload = compactObject({
        ...args.changes,
        ...(args.additionalPayload ?? {})
      });

      if (!args.confirm) {
        const preview = finalizePayload(
          "acc_users_patch",
          buildMcpResponse({
            results: [
              {
                dryRun: true,
                target: {
                  accountId: account.accountId,
                  userId: args.userId
                },
                payload: patchPayload
              }
            ],
            pagination: {
              totalResults: 1,
              returned: 1,
              offset: 0,
              hasMore: false,
              nextOffset: null
            },
            meta: {
              tool: "acc_users_patch",
              generatedAt: new Date().toISOString(),
              source: "hq/v1/accounts/:account_id/users/:user_id",
              accountResolution: account,
              requiresConfirmation: true
            },
            warnings: [
              {
                code: "confirmation_required",
                message:
                  "Cambio sensible no ejecutado. Repite la llamada con confirm=true para aplicar el PATCH.",
                source: "acc_users_patch"
              }
            ]
          }) as Record<string, unknown>
        );

        return {
          content: [{ type: "text", text: stringifyMcpPayload(preview) }]
        };
      }

      const token = await getAccAccessToken();
      const updated = await patchUserDetails({
        token,
        accountId: account.accountId,
        userId: args.userId,
        payload: patchPayload,
        region: args.region
      });

      const payload = finalizePayload(
        "acc_users_patch",
        buildMcpResponse({
          results: [updated as Record<string, unknown>],
          pagination: {
            totalResults: 1,
            returned: 1,
            offset: 0,
            hasMore: false,
            nextOffset: null
          },
          meta: {
            tool: "acc_users_patch",
            generatedAt: new Date().toISOString(),
            source: "hq/v1/accounts/:account_id/users/:user_id",
            accountResolution: account
          }
        }) as Record<string, unknown>
      );

      return { content: [{ type: "text", text: stringifyMcpPayload(payload) }] };
    }
  );
}
