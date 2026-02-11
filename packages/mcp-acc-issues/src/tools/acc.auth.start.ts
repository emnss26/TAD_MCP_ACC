import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { startAccLogin } from "@tad/shared";

export function registerAccAuthStart(server: McpServer) {
  server.registerTool(
    "acc_auth_start",
    {
      title: "ACC Auth - Start",
      description: "Genera el URL para iniciar el flujo de login automático.",
      inputSchema: {},
    },
    async () => {
      const { authorizationUrl, redirectUri, note } = await startAccLogin();

      return {
        content: [
          { type: "text", text: `🔗 URL de Autorización:\n${authorizationUrl}` },
          { type: "text", text: `📍 Redirect URI: ${redirectUri}` },
          { type: "text", text: `📝 Nota: ${note}` },
        ],
      };
    }
  );
}