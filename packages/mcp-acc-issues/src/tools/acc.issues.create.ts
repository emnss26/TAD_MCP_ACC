import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CreateIssueSchema } from "../schemas/issues.js";
import { getAccAccessToken } from "@tad/shared";

export function registerCreateIssue(server: McpServer) {
  server.registerTool(
    "acc_create_issue",
    {
      title: "Issues - Create",
      description: "Crea una nueva incidencia en ACC. Nota: El ID del proyecto b.123 se convierte automáticamente a 123.",
      inputSchema: CreateIssueSchema.shape,
    },
    async (args) => {
      const token = await getAccAccessToken();
      
      // FIX documentación: Quitar prefijo "b." si existe
      const cleanProjectId = args.projectId.replace(/^b\./, "");
      
      const res = await fetch(`https://developer.api.autodesk.com/construction/issues/v1/projects/${cleanProjectId}/issues`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          // Recomendado por la documentación para evitar latencia
          "x-ads-region": "US" 
        },
        body: JSON.stringify(args)
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(
          `Error APS (${res.status}): ${JSON.stringify(errorBody.errors || errorBody.message || res.statusText)}`
        );
      }

      const data = await res.json();

      return {
        content: [{ 
          type: "text", 
          text: `✅ Issue #${data.displayId} creado exitosamente.\nID: ${data.id}\nEstado: ${data.status}` 
        }]
      };
    }
  );
}