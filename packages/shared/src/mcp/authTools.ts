import { z } from "zod";
import {
  startAccLogin,
  getAccAuthStatus,
  logoutAcc
} from "../aps/accAuth.js";
import {
  stringifyMcpPayload,
  getResultHandlePage,
  getResultHandleItem,
  exportResultHandle
} from "../schemas/mcpResponse.js";

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

const PageInput = z.object({
  handle: z.string().min(6),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(10),
  view: z.enum(["summary", "page", "full"]).default("page"),
  fields: z.array(z.string().min(1)).optional()
});

const GetInput = z.object({
  handle: z.string().min(6),
  id: z.string().min(1),
  idField: z.string().min(1).optional(),
  fields: z.array(z.string().min(1)).optional()
});

const ExportInput = z.object({
  handle: z.string().min(6),
  format: z.enum(["csv", "jsonl"]),
  filePath: z.string().min(1).optional(),
  fields: z.array(z.string().min(1)).optional()
});

function asErrorResult(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [{ type: "text", text: `Error: ${message}` }]
  };
}

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
            text: stringifyMcpPayload({
              authorizationUrl,
              redirectUri,
              note
            })
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

export function registerResultHandleTools(server: McpToolServerLike) {
  server.registerTool(
    "mcp_result_page",
    {
      title: "Result Cache - Page",
      description: "Pagina resultados previamente cacheados por handle.",
      inputSchema: PageInput.shape
    },
    async (args: z.infer<typeof PageInput>) => {
      try {
        const payload = getResultHandlePage(args);
        return {
          content: [{ type: "text", text: stringifyMcpPayload(payload) }]
        };
      } catch (error: unknown) {
        return asErrorResult(error);
      }
    }
  );

  server.registerTool(
    "mcp_result_get",
    {
      title: "Result Cache - Get",
      description: "Obtiene un elemento por ID desde un handle cacheado.",
      inputSchema: GetInput.shape
    },
    async (args: z.infer<typeof GetInput>) => {
      try {
        const payload = getResultHandleItem(args);
        return {
          content: [{ type: "text", text: stringifyMcpPayload(payload) }]
        };
      } catch (error: unknown) {
        return asErrorResult(error);
      }
    }
  );

  server.registerTool(
    "mcp_result_export",
    {
      title: "Result Cache - Export",
      description: "Exporta un handle a CSV o JSONL sin cargar filas al chat.",
      inputSchema: ExportInput.shape
    },
    async (args: z.infer<typeof ExportInput>) => {
      try {
        const payload = await exportResultHandle(args);
        return {
          content: [{ type: "text", text: stringifyMcpPayload(payload) }]
        };
      } catch (error: unknown) {
        return asErrorResult(error);
      }
    }
  );
}

export function registerAccAuthTools(server: McpToolServerLike) {
  registerAccAuthStartTool(server);
  registerAccAuthStatusTool(server);
  registerAccAuthLogoutTool(server);
  registerResultHandleTools(server);
}
