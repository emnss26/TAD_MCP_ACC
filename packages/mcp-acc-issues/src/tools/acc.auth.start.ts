import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { startAccLogin } from "@tad/shared";

export function registerAccAuthStart(server: McpServer) {
  server.registerTool(
    "acc_auth_start",
    {
      title: "ACC Auth - Start",
      description: "Genera el URL para iniciar login 3-legged en APS/ACC.",
      inputSchema: {},
    },
    async () => {
      const { authorizationUrl, redirectUri, instructions, note } = await startAccLogin();

      return {
        content: [
          { type: "text", text: `Authorization URL:\n${authorizationUrl}` },
          { type: "text", text: `Redirect URI:\n${redirectUri}` },
          { type: "text", text: `Instructions:\n${instructions}\n\n${note}` },
        ],
      };
    }
  );
}
