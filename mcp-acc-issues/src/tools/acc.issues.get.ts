import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";
import { getAccAccessToken } from "@tad/acc-shared/aps/oauth.js";
import { listIssues } from "../acc/issues.client.js";

const Input = z.object({
    projectId: z.string().min(10).optional(),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0)
});

export function listIssuesTool(server: Server) {
    server.tool(
        "acc_issues_list",
        "Lista issues de Autodesk Construction Cloud (ACC) para un proyecto.",
        Input.shape,
        async (args) => {
            const token = await getAccAccessToken(); // refresh -> access
            const projectId = args.projectId ?? process.env.ACC_PROJECT_ID!;
            const data = await listIssues({ token, projectId, limit: args.limit, offset: args.offset });
            return { content: [{ type: "text", text: JSON.stringify(data) }] };
        }
    );
}