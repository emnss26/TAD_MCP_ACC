import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAccAuthTools } from "@tad/shared";

import { registerBim360ProjectsGet } from "./tools/acc.project.get.js";
import { registerBim360ProjectGet } from "./tools/bim360.project.single.get.js";
import { registerBim360CompaniesGet } from "./tools/acc.companies.get.js";
import { registerBim360ProjectCompaniesGet } from "./tools/acc.project.companies.get.js";
import { registerBim360AccountUsersGet } from "./tools/acc.account.users.get.js";
import { registerBim360UserGet } from "./tools/bim360.user.get.js";
import { registerBim360ProjectUsersGet } from "./tools/acc.project.users.get.js";

const server = new McpServer({
  name: "mcp-bim360-account-admin",
  version: "1.0.0"
});

registerAccAuthTools(server);
registerBim360ProjectsGet(server);
registerBim360ProjectGet(server);
registerBim360CompaniesGet(server);
registerBim360ProjectCompaniesGet(server);
registerBim360AccountUsersGet(server);
registerBim360UserGet(server);
registerBim360ProjectUsersGet(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BIM 360 Account Admin MCP Server running...");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
