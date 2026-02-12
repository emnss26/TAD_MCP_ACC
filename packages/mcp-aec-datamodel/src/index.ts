import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Importamos las herramientas del paquete
import { registerAecProjects } from "./tools/aec.get.projects.js";
import { registerAecQuantities } from "./tools/aec.get.quantities.js";

// Importamos herramientas de auth (copiadas localmente como en los otros módulos)
import { registerAccAuthStart } from "./tools/acc.auth.start.js";
import { registerAccAuthStatus } from "./tools/acc.auth.status.js";
import { registerAccAuthLogout } from "./tools/acc.auth.logout.js";

const server = new McpServer({
  name: "mcp-aec-datamodel",
  version: "1.0.0",
});

// Registro de herramientas de Autenticación
registerAccAuthStart(server);
registerAccAuthStatus(server);
registerAccAuthLogout(server);

// Registro de herramientas de AEC Data Model
registerAecProjects(server);
registerAecQuantities(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AEC Data Model MCP Server running... 🏗️");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});