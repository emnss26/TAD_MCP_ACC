import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAccAuthTools } from "@tad/shared";

import { registerAecHubs } from "./tools/aec.get.hubs.js";
import { registerAecProjects } from "./tools/aec.get.projects.js";
import { registerAecElementsByProject } from "./tools/aec.get.elements.by.project.js";
import { registerAecQuantities } from "./tools/aec.get.quantities.js";

const server = new McpServer({
  name: "mcp-aec-datamodel",
  version: "1.0.0",
});

registerAccAuthTools(server);

registerAecHubs(server);
registerAecProjects(server);
registerAecElementsByProject(server);
registerAecQuantities(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AEC Data Model MCP Server running...");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
