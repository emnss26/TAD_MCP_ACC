import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getProjectUsers, getIssueTypes, getCustomAttributeDefinitions } from "../acc/admin.client.js";

const ContextSchema = z.object({
  projectId: z.string().describe("ID del proyecto (b.xxx)"),
  containerId: z.string().describe("ID del contenedor de issues (GUID)")
});

export function registerIssueContextTools(server: McpServer) {
  server.registerTool(
    "acc_get_issue_context",
    {
      title: "Issues - Get Context Mapping",
      description: "Obtiene diccionarios de usuarios, tipos de incidencias y atributos para traducir IDs a nombres reales.",
      inputSchema: ContextSchema.shape,
    },
    async (args) => {
      const [users, types, attrs] = await Promise.all([
        getProjectUsers(args.projectId),
        getIssueTypes(args.containerId),
        getCustomAttributeDefinitions(args.containerId)
      ]);

      const mapping = {
        users: users.results.map((u: any) => ({ id: u.autodeskId, name: u.name, email: u.email })),
        issueTypes: types.results.map((t: any) => ({
          id: t.id,
          title: t.title,
          subtypes: t.subtypes.map((s: any) => ({ id: s.id, title: s.title }))
        })),
        customAttributes: attrs.results.map((a: any) => ({ id: a.id, title: a.title, type: a.dataType }))
      };

      return {
        content: [{ type: "text", text: JSON.stringify(mapping, null, 2) }]
      };
    }
  );
}