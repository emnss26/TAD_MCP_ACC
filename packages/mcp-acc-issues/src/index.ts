import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerAccAuthStart } from "./tools/acc.auth.start.js";
import { registerAccAuthStatus } from "./tools/acc.auth.status.js";
import { registerAccAuthLogout } from "./tools/acc.auth.logout.js";
import { registerAccAuthLogin } from "./tools/acc.auth.login.js";
import { registerAccIssuesList } from "./tools/acc.issues.get.js";

const server = new McpServer({
  name: "MCP_ACC_Issues",
  version: "0.1.0",
});

registerAccAuthLogin(server);
registerAccAuthStart(server);
registerAccAuthStatus(server);
registerAccAuthLogout(server);
registerAccIssuesList(server);

const transport = new StdioServerTransport();
await server.connect(transport);