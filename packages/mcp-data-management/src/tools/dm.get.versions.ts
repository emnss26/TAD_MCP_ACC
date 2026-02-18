import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildMcpResponse,
  parseOffsetCursor,
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
      const allResults = data.map(toVersion);
      const offset = parseOffsetCursor(args.cursor) ?? args.offset ?? 0;
      const end = offset + args.limit;
      const results = allResults.slice(offset, end);
      const hasMore = end < allResults.length;

      const payload = buildMcpResponse({
        results,
        pagination: {
          limit: args.limit,
          offset,
          totalResults: allResults.length,
          returned: results.length,
          hasMore,
          nextOffset: hasMore ? end : null
        },
        meta: {
          tool: "dm_get_versions",
          generatedAt: new Date().toISOString(),
          source: "data.v1/projects/:projectId/items/:itemId/versions",
          projectId: args.projectId,
          itemId: args.itemId,
          options: {
            limit: args.limit,
            offset,
            cursor: args.cursor,
            view: args.view,
            outputFields: args.outputFields
          }
        },
        warnings:
          allResults.length === 0
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
