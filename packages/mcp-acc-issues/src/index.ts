import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAccAuthTools } from "@tad/shared";

import { registerAccIssuesList } from "./tools/acc.issues.get.js";
import { registerIssueContextTools } from "./tools/acc.issues.context.js";
import { registerCreateIssue } from "./tools/acc.issues.create.js";

const server = new McpServer({
  name: "mcp-acc-issues",
  version: "1.0.0"
});

registerAccAuthTools(server);
registerAccIssuesList(server);

registerIssueContextTools(server);
registerCreateIssue(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ACC Issues MCP Server running...");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
