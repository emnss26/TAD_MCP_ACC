import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { listIssuesTool } from "./tools/acc.issues.get.js";

const server = new Server(
    { name: "MCP_ACC_Issues", version: "0.1.0" },
    { capabilities: { tools: {} } }
);

listIssuesTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);