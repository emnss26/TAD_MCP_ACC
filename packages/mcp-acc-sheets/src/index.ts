import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAccAuthTools } from "@tad/shared";

import { registerAccSheetsCollectionsGet } from "./tools/acc.sheets.collections.get.js";
import { registerAccSheetsCollectionGet } from "./tools/acc.sheets.collection.get.js";
import { registerAccSheetsGet } from "./tools/acc.sheets.get.js";
import { registerAccSheetsVersionSetsGet } from "./tools/acc.sheets.version.sets.get.js";

const server = new McpServer({
  name: "mcp-acc-sheets",
  version: "1.0.0"
});

registerAccAuthTools(server);
registerAccSheetsCollectionsGet(server);
registerAccSheetsCollectionGet(server);
registerAccSheetsGet(server);
registerAccSheetsVersionSetsGet(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ACC Sheets MCP Server running...");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
