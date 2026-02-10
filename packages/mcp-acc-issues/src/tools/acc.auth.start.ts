import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { startAccLogin } from "@tad/shared";

export function registerAccAuthStart(server: McpServer) {
  server.registerTool(
    "acc_auth_start",
    {
      title: "ACC Auth - Start Login",
      description: "Inicia login 3-legged (abre URL en navegador). Guarda access/refresh token localmente.",
      inputSchema: {}
    },
    async () => {
      const { authorizationUrl, redirectUri, note } = await startAccLogin();
      return {
        content: [
          { type: "text", text: `Abre este URL en tu navegador:\n${authorizationUrl}\n\nRedirect URI:\n${redirectUri}\n\n${note}` }
        ]
      };
    }
  );
}