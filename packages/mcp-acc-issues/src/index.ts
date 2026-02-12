import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerAccAuthStart } from "./tools/acc.auth.start.js";
import { registerAccAuthStatus } from "./tools/acc.auth.status.js";
import { registerAccLogout } from "./tools/acc.auth.logout.js";

import { registerAccIssuesList } from "./tools/acc.issues.get.js";
import { registerIssueContextTools } from "./tools/acc.issues.context.js";

const server = new McpServer({
  name: "MCP_ACC_Issues",
  version: "0.1.0",
});


registerAccAuthStart(server);
registerAccAuthStatus(server);
registerAccLogout(server);
registerAccIssuesList(server);
registerIssueContextTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);