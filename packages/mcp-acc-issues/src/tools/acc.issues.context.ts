import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getProjectUsers, getIssueTypes, getCustomAttributeDefinitions,getIssueAttributeMappings  } from "../acc/admin.client.js";

const ContextSchema = z.object({
  projectId: z.string().describe("ID del proyecto (b.xxx)"),
  containerId: z.string().describe("ID del contenedor de issues (GUID)")
});

export function registerIssueContextTools(server: McpServer) {
  server.registerTool(
    "acc_get_issue_context",
    {
      title: "Issues - Get Context Mapping",
      description: "Obtiene diccionarios completos para traducir IDs de usuarios, tipos y atributos personalizados (incluyendo opciones de listas).",
      inputSchema: ContextSchema.shape,
    },
    async (args) => {
      const [users, types, attrs, mappings] = await Promise.all([
        getProjectUsers(args.projectId),
        getIssueTypes(args.containerId),
        getCustomAttributeDefinitions(args.containerId),
        getIssueAttributeMappings(args.containerId)
      ]);

      const mapping = {
        users: users.results.map((u: any) => ({ id: u.autodeskId, name: u.name, email: u.email })),
        issueTypes: types.results.map((t: any) => ({
          id: t.id,
          title: t.title,
          subtypes: t.subtypes.map((s: any) => ({ id: s.id, title: s.title }))
        })),
        customAttributes: attrs.results.map((a: any) => ({
          id: a.id,
          title: a.title,
          dataType: a.dataType,
          // Si es una lista, incluimos las opciones para traducir el ID del valor seleccionado
          options: a.metadata?.list?.options ?? []
        })),
        attributeMappings: mappings.results.map((m: any) => ({
          id: m.id,
          definitionId: m.attributeDefinitionId,
          mappedItemId: m.mappedItemId // ID del tipo/subtipo al que pertenece
        }))
      };

      return {
        content: [{ type: "text", text: JSON.stringify(mapping, null, 2) }]
      };
    }
  );
}