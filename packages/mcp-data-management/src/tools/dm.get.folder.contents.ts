import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FolderContentsSchema } from "../schemas/dm.js";
import { getFolderContents } from "../dm/dm.client.js";

export function registerGetFolderContents(server: McpServer) {
  server.registerTool(
    "dm_list_folder",
    {
      title: "DM - List Folder Contents",
      description: "Lista archivos y subcarpetas dentro de una carpeta específica.",
      inputSchema: FolderContentsSchema.shape,
    },
    async (args) => {
      const raw = await getFolderContents(args.projectId, args.folderId);
      
      const items = raw.data.map((item: any) => {
        const type = item.type === "folders" ? "📁 Carpeta" : "📄 Archivo";
        return `${type}: ${item.attributes.displayName} (ID: ${item.id})`;
      }).join("\n");

      return {
        content: [{ 
          type: "text", 
          text: items || "La carpeta está vacía." 
        }]
      };
    }
  );
}