import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAccAuthTools } from "@tad/shared";

import { registerAccFilesFolderPermissionsGet } from "./tools/acc.files.folder.permissions.get.js";

const server = new McpServer({
  name: "mcp-acc-files",
  version: "1.0.0"
});

registerAccAuthTools(server);
registerAccFilesFolderPermissionsGet(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ACC Files MCP Server running...");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
