import { getAccAccessToken } from "./accAuth.js";

const AEC_DESIGN_URL = "https://developer.api.autodesk.com/aec/datamodel/v1/graphql";

/**
 * Ejecuta una consulta GraphQL contra el AEC Data Model.
 * Útil para obtener propiedades de elementos, niveles, parámetros de Revit, etc.
 */
export async function queryAecDataModel(query: string, variables?: Record<string, any>) {
  const token = await getAccAccessToken();
  
  const res = await fetch(AEC_DESIGN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`AEC Data Model Error (${res.status}): ${errorText}`);
  }

  return await res.json();
}