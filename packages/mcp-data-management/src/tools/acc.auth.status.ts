import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAccAuthStatus } from "@tad/shared";
import { z } from "zod";

export function registerAccAuthStatus(server: McpServer) {
  server.registerTool(
    "acc_auth_status",
    {
      title: "ACC Auth Status",
      description: "Verifica si el usuario está autenticado en Autodesk Construction Cloud.",
      inputSchema: z.object({}).shape,
    },
    async () => {
      // FIX: Añadimos await porque getAccAuthStatus es async
      const status = await getAccAuthStatus(); 
      return {
        content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
      };
    }
  );
}