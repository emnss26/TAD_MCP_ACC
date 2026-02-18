import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAccAuthTools } from "@tad/shared";

import { registerAecProjects } from "./tools/aec.get.projects.js";
import { registerAecModels } from "./tools/aec.get.models.js";
import { registerAecElementsByModel } from "./tools/aec.get.elements.by.model.js";
import { registerAecElementsByProject } from "./tools/aec.get.elements.by.project.js";
import { registerAecQuantities } from "./tools/aec.get.quantities.js";

const server = new McpServer({
  name: "mcp-aec-datamodel",
  version: "1.0.0",
});

registerAccAuthTools(server);

registerAecProjects(server);
registerAecModels(server);
registerAecElementsByModel(server);
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