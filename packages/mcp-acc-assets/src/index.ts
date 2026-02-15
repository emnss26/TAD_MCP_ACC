import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAccAuthTools } from "@tad/shared";

import { registerAccAssetsList } from "./tools/acc.assets.get.js";

const server = new McpServer({
  name: "mcp-acc-assets",
  version: "1.0.0"
});

registerAccAuthTools(server);
registerAccAssetsList(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ACC Assets MCP Server running...");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
