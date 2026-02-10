import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logoutAcc } from "@tad/shared";

export function registerAccAuthLogout(server: McpServer) {
  server.registerTool(
    "acc_auth_logout",
    {
      title: "ACC Auth - Logout",
      description: "Borra tokens guardados y cierra cualquier login pendiente.",
      inputSchema: {}
    },
    async () => {
      const res = await logoutAcc();
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }
  );
}