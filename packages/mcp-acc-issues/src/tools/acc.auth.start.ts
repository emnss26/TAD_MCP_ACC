import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { startAccLogin } from "@tad/shared";

export function registerAccAuthStart(server: McpServer) {
  server.registerTool(
    "acc_auth_start",
    {
      title: "ACC Auth - Start",
      description: "Inicia el flujo de autenticación automática para ACC.",
      inputSchema: {},
    },
    async () => {
      const { authorizationUrl, redirectUri, note } = await startAccLogin();

      return {
        content: [
          { 
            type: "text", 
            text: `🔗 URL DE AUTORIZACIÓN:\n${authorizationUrl}\n\n` +
                  `📍 REDIRECT URI: ${redirectUri}\n\n` +
                  `📝 NOTA: ${note}` 
          },
        ],
      };
    }
  );
}