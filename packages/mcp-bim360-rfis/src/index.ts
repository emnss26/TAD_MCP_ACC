import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAccAuthTools } from "@tad/shared";

import { registerBim360RfisList } from "./tools/bim360.rfis.get.js";

const server = new McpServer({
  name: "mcp-bim360-rfis",
  version: "1.0.0"
});

registerAccAuthTools(server);
registerBim360RfisList(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BIM 360 RFIs MCP Server running...");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
