import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAccAuthTools } from "@tad/shared";

import { registerAccProjectGet } from "./tools/acc.project.get.js";
import { registerAccCompaniesGet } from "./tools/acc.companies.get.js";
import { registerAccProjectCompaniesGet } from "./tools/acc.project.companies.get.js";
import { registerAccAccountUsersGet } from "./tools/acc.account.users.get.js";
import { registerAccProjectUsersGet } from "./tools/acc.project.users.get.js";
import { registerAccAccountUsersCreate } from "./tools/acc.account.users.create.js";
import { registerAccProjectUsersCreate } from "./tools/acc.project.users.create.js";
import { registerAccProjectUsersPatch } from "./tools/acc.project.users.patch.js";
import { registerAccCompaniesPatch } from "./tools/acc.companies.patch.js";
import { registerAccUsersPatch } from "./tools/acc.users.patch.js";

const server = new McpServer({
  name: "mcp-acc-account-admin",
  version: "1.0.0"
});

registerAccAuthTools(server);
registerAccProjectGet(server);
registerAccCompaniesGet(server);
registerAccProjectCompaniesGet(server);
registerAccAccountUsersGet(server);
registerAccProjectUsersGet(server);
registerAccAccountUsersCreate(server);
registerAccProjectUsersCreate(server);
registerAccProjectUsersPatch(server);
registerAccCompaniesPatch(server);
registerAccUsersPatch(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ACC Account Admin MCP Server running...");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
