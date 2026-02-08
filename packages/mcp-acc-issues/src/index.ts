import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { listIssuesTool } from "./tools/acc.issues.get.js";

// CAMBIO: Usamos McpServer en vez de Server
const server = new McpServer({
    name: "MCP_ACC_Issues",
    version: "0.1.0"
});

listIssuesTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);