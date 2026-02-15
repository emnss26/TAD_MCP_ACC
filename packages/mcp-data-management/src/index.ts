import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAccAuthTools } from "@tad/shared";

import { registerGetProjects } from "./tools/dm.get.projects.js";
import { registerGetProjectDetails } from "./tools/dm.get.project.js";
import { registerGetFolderContents } from "./tools/dm.get.folder.contents.js";
import { registerGetItemVersions } from "./tools/dm.get.versions.js";

const server = new McpServer({
  name: "mcp-data-management",
  version: "1.0.0"
});

registerAccAuthTools(server);
registerGetProjects(server);
registerGetProjectDetails(server);
registerGetFolderContents(server);
registerGetItemVersions(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Data Management MCP Server running...");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
