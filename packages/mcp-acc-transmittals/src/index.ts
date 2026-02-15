import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAccAuthTools } from "@tad/shared";

import { registerAccTransmittalsList } from "./tools/acc.transmittals.get.js";

const server = new McpServer({
  name: "mcp-acc-transmittals",
  version: "1.0.0"
});

registerAccAuthTools(server);
registerAccTransmittalsList(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ACC Transmittals MCP Server running...");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
