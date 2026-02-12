import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CreateIssueSchema } from "../schemas/issues.js";
import { getAccAccessToken } from "@tad/shared";

export function registerCreateIssue(server: McpServer) {
  server.registerTool(
    "acc_create_issue",
    {
      title: "Issues - Create",
      description: "Crea una nueva incidencia en ACC. El ID del proyecto (ej: b.123) se limpia automáticamente para la API de Construction.",
      inputSchema: CreateIssueSchema.shape,
    },
    async (args) => {
      const token = await getAccAccessToken();
      
      // Limpieza del Project ID: Quitar prefijo "b." si existe para compatibilidad con ACC API
      const cleanProjectId = args.projectId.replace(/^b\./, "");
      
      // Separamos el projectId del resto de los argumentos para no enviarlo en el body del POST
      const { projectId, ...issueBody } = args;

      const res = await fetch(`https://developer.api.autodesk.com/construction/issues/v1/projects/${cleanProjectId}/issues`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "x-ads-region": "US" // Región recomendada por la documentación de APS
        },
        body: JSON.stringify(issueBody)
      });

      if (!res.ok) {
        // Manejo de error detallado extrayendo el mensaje del backend de APS
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