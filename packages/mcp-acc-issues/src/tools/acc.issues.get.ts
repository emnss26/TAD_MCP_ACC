import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAccAccessToken } from "@tad/shared";
import { listIssues } from "../acc/issues.client.js";

const Input = z.object({
  projectId: z.string().min(10).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0)
});

type InputArgs = z.infer<typeof Input>;

export function listIssuesTool(server: McpServer) {
  server.registerTool(
    "acc_issues_list",
    {
      title: "ACC Issues - List",
      description: "Lista issues de Autodesk Construction Cloud (ACC) para un proyecto.",
      inputSchema: Input.shape
    },
    async (args: InputArgs) => {
      const token = await getAccAccessToken();
      const projectId = args.projectId ?? process.env.ACC_PROJECT_ID!;
      const data = await listIssues({ token, projectId, limit: args.limit, offset: args.offset });

      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}