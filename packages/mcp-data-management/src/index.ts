import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// ✅ Importa desde tus herramientas locales, no desde shared
import { registerAccAuthStart } from "./tools/acc.auth.start.js";
import { registerAccAuthStatus } from "./tools/acc.auth.status.js";
import { registerAccLogout } from "./tools/acc.auth.logout.js";
import { registerGetProjects } from "./tools/dm.get.projects.js";
import { registerGetProjectDetails } from "./tools/dm.get.project.js"; // La del JSON de relationships
import { registerGetFolderContents } from "./tools/dm.get.folder.contents.js";
import { registerGetItemVersions } from "./tools/dm.get.versions.js";

const server = new McpServer({
  name: "mcp-acc-data-management",
  version: "1.0.0",
});

// Registrar herramientas de Auth locales
registerAccAuthStart(server);
registerAccAuthStatus(server);
registerAccLogout(server);

// Registrar herramientas de Data Management
registerGetProjects(server);
registerGetProjectDetails(server); 
registerGetFolderContents(server);
registerGetItemVersions(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Data Management MCP Server running... ✅");
}

main().catch(console.error);