import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { stringifyMcpPayload } from "@tad/shared";
import { z } from "zod";
import {
  getIssueTypes,
  getCustomAttributeDefinitions,
  getIssueAttributeMappings
} from "../acc/admin.client.js";

const ContextSchema = z.object({
  containerId: z.string().describe("ID del contenedor de issues (GUID).")
});

function getResults(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter((item) => item && typeof item === "object") as Array<
      Record<string, unknown>
    >;
  }
  if (payload && typeof payload === "object" && Array.isArray((payload as any).results)) {
    return (payload as any).results;
  }
  return [];
}

export function registerBim360IssueContextTools(server: McpServer) {
  server.registerTool(
    "bim360_get_issue_context",
    {
      title: "BIM 360 Issues - Get Context",
      description:
        "Obtiene tipos de issue, definiciones de atributos y mapeos de atributos para un containerId.",
      inputSchema: ContextSchema.shape
    },
    async (args) => {
      const [typesRaw, attrsRaw, mappingsRaw] = await Promise.all([
        getIssueTypes(args.containerId),
        getCustomAttributeDefinitions(args.containerId),
        getIssueAttributeMappings(args.containerId)
      ]);

      const types = getResults(typesRaw);
      const attributes = getResults(attrsRaw);
      const mappings = getResults(mappingsRaw);

      const mapping = {
        issueTypes: types.map((item) => {
          const subtypes = Array.isArray(item.subtypes)
            ? item.subtypes.filter((subtype) => subtype && typeof subtype === "object")
            : [];
          return {
            ...item,
            subtypes
          };
        }),
        customAttributes: attributes.map((item) => ({
          ...item,
          options:
            item.metadata &&
            typeof item.metadata === "object" &&
            (item.metadata as Record<string, unknown>).list &&
            typeof (item.metadata as Record<string, unknown>).list === "object"
              ? ((item.metadata as any).list.options ?? [])
              : []
        })),
        attributeMappings: mappings
      };

      return {
        content: [{ type: "text", text: stringifyMcpPayload(mapping) }]
      };
    }
  );
}
