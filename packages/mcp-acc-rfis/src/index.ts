import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAccAuthTools } from "@tad/shared";

import { registerAccRfisList } from "./tools/acc.rfis.get.js";
import { registerAccRfiCreate } from "./tools/acc.rfis.create.js";

const server = new McpServer({
  name: "mcp-acc-rfis",
  version: "1.0.0"
});

registerAccAuthTools(server);
registerAccRfisList(server);
registerAccRfiCreate(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ACC RFIs MCP Server running...");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
