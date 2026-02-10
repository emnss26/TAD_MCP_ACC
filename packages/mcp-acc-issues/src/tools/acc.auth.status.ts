import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAccAuthStatus } from "@tad/shared";

export function registerAccAuthStatus(server: McpServer) {
  server.registerTool(
    "acc_auth_status",
    {
      title: "ACC Auth - Status",
      description: "Muestra si hay sesión activa y cuándo expira el token.",
      inputSchema: {}
    },
    async () => {
      const status = await getAccAuthStatus();
      return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
    }
  );
}