import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAccAuthTools } from "@tad/shared";

import { registerBim360IssuesList } from "./tools/bim360.issues.get.js";
import { registerBim360IssueContextTools } from "./tools/bim360.issues.context.js";

const server = new McpServer({
  name: "mcp-bim360-issues",
  version: "1.0.0"
});

registerAccAuthTools(server);
registerBim360IssuesList(server);
registerBim360IssueContextTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BIM 360 Issues MCP Server running...");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
