import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { accLogout } from "@tad/shared";
import { z } from "zod";

export function registerAccLogout(server: McpServer) {
  server.registerTool(
    "acc_auth_logout",
    {
      title: "ACC Logout",
      description: "Cierra la sesión y elimina los tokens de Autodesk.",
      inputSchema: z.object({}).shape,
    },
    async () => {
      // FIX: Añadimos await para asegurar que los archivos de tokens se borren
      await accLogout(); 
      return {
        content: [{ type: "text", text: "Sesión cerrada exitosamente." }],
      };
    }
  );
}