import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ItemVersionsSchema } from "../schemas/dm.js";
import { getItemVersions } from "../dm/dm.client.js";

export function registerGetItemVersions(server: McpServer) {
  server.registerTool(
    "dm_get_versions",
    {
      title: "DM - Get Item Versions",
      description: "Obtiene el historial de versiones de un archivo, incluyendo autor y fecha.",
      inputSchema: ItemVersionsSchema.shape,
    },
    async (args) => {
      const raw = await getItemVersions(args.projectId, args.itemId);
      
      const versions = raw.data.map((v: any) => {
        const attr = v.attributes;
        return `V${attr.versionNumber}: ${attr.displayName} | Por: ${attr.lastModifiedUserName} (${new Date(attr.lastModifiedTime).toLocaleString()})`;
      }).join("\n");

      return {
        content: [{ type: "text", text: `Historial de versiones:\n\n${versions}` }]
      };
    }
  );
}