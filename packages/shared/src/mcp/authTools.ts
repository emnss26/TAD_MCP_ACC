import {
  startAccLogin,
  getAccAuthStatus,
  logoutAcc
} from "../aps/accAuth.js";
import { stringifyMcpPayload } from "../schemas/mcpResponse.js";

type ToolContent = {
  type: "text";
  text: string;
};

type ToolResult = {
  content: ToolContent[];
  isError?: boolean;
};

export type McpToolServerLike = {
  registerTool: (...args: any[]) => unknown;
};

export function registerAccAuthStartTool(server: McpToolServerLike) {
  server.registerTool(
    "acc_auth_start",
    {
      title: "ACC Auth - Start",
      description: "Genera el URL para iniciar el flujo de login automatico.",
      inputSchema: {}
    },
    async () => {
      const { authorizationUrl, redirectUri, note } = await startAccLogin();
      return {
        content: [
          {
            type: "text",
            text: stringifyMcpPayload(
              {
                authorizationUrl,
                redirectUri,
                note
              }
            )
          }
        ]
      };
    }
  );
}

export function registerAccAuthStatusTool(server: McpToolServerLike) {
  server.registerTool(
    "acc_auth_status",
    {
      title: "ACC Auth Status",
      description: "Verifica si el usuario esta autenticado en Autodesk Construction Cloud.",
      inputSchema: {}
    },
    async () => {
      const status = await getAccAuthStatus();
      return {
        content: [{ type: "text", text: stringifyMcpPayload(status) }]
      };
    }
  );
}

export function registerAccAuthLogoutTool(server: McpToolServerLike) {
  server.registerTool(
    "acc_auth_logout",
    {
      title: "ACC Auth Logout",
      description: "Cierra la sesion y elimina los tokens de Autodesk.",
      inputSchema: {}
    },
    async () => {
      await logoutAcc();
      return {
        content: [{ type: "text", text: stringifyMcpPayload({ ok: true }) }]
      };
    }
  );
}

export function registerAccAuthTools(server: McpToolServerLike) {
  registerAccAuthStartTool(server);
  registerAccAuthStatusTool(server);
  registerAccAuthLogoutTool(server);
}
