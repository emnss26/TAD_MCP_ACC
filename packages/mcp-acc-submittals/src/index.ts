import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAccAuthTools } from "@tad/shared";

import { registerAccSubmittalsList } from "./tools/acc.submittals.get.js";
import { registerAccSubmittalsTransition } from "./tools/acc.submittals.transition.js";

const server = new McpServer({
  name: "mcp-acc-submittals",
  version: "1.0.0"
});

registerAccAuthTools(server);
registerAccSubmittalsList(server);
registerAccSubmittalsTransition(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ACC Submittals MCP Server running...");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
