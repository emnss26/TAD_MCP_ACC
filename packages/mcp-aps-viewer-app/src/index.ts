import cors from "cors";
import type { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAppResource, registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { PORT, ALLOWED_HOSTS } from "./config.js";
import * as tools from "./tools/index.js";
import * as resources from "./resources/index.js";

type DerivativeFormat = "latest" | "fallback";

function createServer(options: { derivativeFormat: DerivativeFormat }) {
  const server = new McpServer({
    name: "mcp-aps-viewer-app",
    version: "1.0.0"
  });

  for (const toolFactory of Object.values(tools) as Array<(options: {
    derivativeFormat: DerivativeFormat;
  }) => any>) {
    const { name, config, callback } = toolFactory(options as any);
    registerAppTool(server, name, config, callback);
  }

  for (const resourceFactory of Object.values(resources) as Array<(options?: {
    derivativeFormat: DerivativeFormat;
  }) => any>) {
    const { name, uri, config, callback } = resourceFactory(options);
    registerAppResource(server, name, uri, config, callback);
  }

  return server;
}

function resolveDerivativeFormatFromEnv(): DerivativeFormat {
  const mode = (process.env.VIEWER_DERIVATIVE_FORMAT ?? "").trim().toLowerCase();
  return mode === "fallback" || mode === "svf" ? "fallback" : "latest";
}

function shouldUseStdioTransport(): boolean {
  const args = new Set(process.argv.slice(2).map((value) => value.trim().toLowerCase()));
  if (args.has("--stdio")) return true;
  if (args.has("--http")) return false;

  const mode = (process.env.MCP_TRANSPORT ?? process.env.VIEWER_TRANSPORT ?? "")
    .trim()
    .toLowerCase();
  if (mode === "http") return false;
  return true;
}

async function runStdioServer() {
  const server = createServer({
    derivativeFormat: resolveDerivativeFormatFromEnv()
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Viewer MCP app running on stdio transport.");
}

function runHttpServer() {
  const app = createMcpExpressApp({
    host: "0.0.0.0",
    allowedHosts: ALLOWED_HOSTS
  });

  app.use(cors());

  app.all("/mcp", async (req: Request, res: Response) => {
    const derivativeFormat: DerivativeFormat =
      req.query.format === "svf" ? "fallback" : "latest";
    const server = createServer({ derivativeFormat });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error"
          },
          id: null
        });
      }
    }
  });

  app.listen(PORT, (err?: unknown) => {
    if (err) {
      console.error("Failed to start viewer app:", err);
      process.exit(1);
    }
    console.error(`Viewer MCP app listening on http://localhost:${PORT}/mcp`);
  });
}

if (shouldUseStdioTransport()) {
  runStdioServer().catch((error) => {
    console.error("Failed to start viewer app on stdio transport:", error);
    process.exit(1);
  });
} else {
  runHttpServer();
}
