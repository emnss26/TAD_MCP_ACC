import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logoutAcc } from "@tad/shared";

export function registerAccAuthLogout(server: McpServer) {
  server.registerTool(
    "acc_auth_logout",
    {
      title: "ACC Auth - Logout",
      description: "Borra la sesión ACC almacenada.",
      inputSchema: {},
    },
    async () => {
      logoutAcc();
      return { content: [{ type: "text", text: "Logout OK. Sesión ACC eliminada." }] };
    }
  );
}
