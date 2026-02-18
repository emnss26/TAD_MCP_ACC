import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildMcpResponse,
  parseOffsetCursor,
  stringifyMcpPayload
} from "@tad/shared";
import { FolderContentsSchema } from "../schemas/dm.js";
import { getFolderContents } from "../dm/dm.client.js";

function toFolderItem(item: any) {
  const isFolder = item?.type === "folders";
  return {
    id: item?.id ?? null,
    type: item?.type ?? null,
    objectType: isFolder ? "folder" : "file",
    name: item?.attributes?.displayName ?? null,
    extensionType: item?.attributes?.extension?.type ?? null,
    createTime: item?.attributes?.createTime ?? null,
    lastModifiedTime: item?.attributes?.lastModifiedTime ?? null,
    versionNumber: item?.attributes?.versionNumber ?? null
  };
}

export function registerGetFolderContents(server: McpServer) {
  server.registerTool(
    "dm_list_folder",
    {
      title: "DM - List Folder Contents",
      description: "Lista archivos y subcarpetas dentro de una carpeta especifica.",
      inputSchema: FolderContentsSchema.shape
    },
    async (args) => {
      const raw = await getFolderContents(args.projectId, args.folderId);
      const data = Array.isArray(raw?.data) ? raw.data : [];
      const allResults = data.map(toFolderItem);
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
          tool: "dm_list_folder",
          generatedAt: new Date().toISOString(),
          source: "data.v1/projects/:projectId/folders/:folderId/contents",
          projectId: args.projectId,
          folderId: args.folderId,
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
                  code: "empty_folder",
                  message: "La carpeta no contiene elementos visibles.",
                  source: "dm_list_folder"
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
