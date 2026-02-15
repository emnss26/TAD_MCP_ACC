import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildMcpResponse,
  stringifyMcpPayload
} from "@tad/shared";
import { ItemVersionsSchema } from "../schemas/dm.js";
import { getItemVersions } from "../dm/dm.client.js";

function toVersion(item: any) {
  const attr = item?.attributes ?? {};
  return {
    id: item?.id ?? null,
    versionNumber: attr?.versionNumber ?? null,
    name: attr?.displayName ?? null,
    mimeType: attr?.mimeType ?? null,
    fileType: attr?.fileType ?? null,
    storageSize: attr?.storageSize ?? null,
    lastModifiedUserName: attr?.lastModifiedUserName ?? null,
    lastModifiedTime: attr?.lastModifiedTime ?? null
  };
}

export function registerGetItemVersions(server: McpServer) {
  server.registerTool(
    "dm_get_versions",
    {
      title: "DM - Get Item Versions",
      description: "Obtiene el historial de versiones de un archivo, incluyendo autor y fecha.",
      inputSchema: ItemVersionsSchema.shape
    },
    async (args) => {
      const raw = await getItemVersions(args.projectId, args.itemId);
      const data = Array.isArray(raw?.data) ? raw.data : [];
      const results = data.map(toVersion);

      const payload = buildMcpResponse({
        results,
        pagination: {
          totalResults: results.length,
          returned: results.length,
          offset: 0,
          hasMore: false,
          nextOffset: null
        },
        meta: {
          tool: "dm_get_versions",
          generatedAt: new Date().toISOString(),
          source: "data.v1/projects/:projectId/items/:itemId/versions",
          projectId: args.projectId,
          itemId: args.itemId
        },
        warnings:
          results.length === 0
            ? [
                {
                  code: "no_versions",
                  message: "No se encontraron versiones para el item solicitado.",
                  source: "dm_get_versions"
                }
              ]
            : []
      });

      return {
        content: [{ type: "text", text: stringifyMcpPayload(payload) }]
      };
    }
  );
}
