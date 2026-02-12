import { getAccAccessToken } from "@tad/shared";

const ADMIN_URL = "https://developer.api.autodesk.com/construction/admin/v1";
const ISSUES_URL = "https://developer.api.autodesk.com/issues/v1";

async function fetchAps(url: string) {
  const token = await getAccAccessToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Error APS Admin (${res.status}): ${res.statusText}`);
  return await res.json();
}

// Obtener usuarios del proyecto (para mapear assignedTo, createdBy, etc.)
export const getProjectUsers = (projectId: string) => 
  fetchAps(`${ADMIN_URL}/projects/${projectId}/users`);

// Obtener empresas del proyecto
export const getProjectCompanies = (projectId: string) => 
  fetchAps(`${ADMIN_URL}/projects/${projectId}/companies`);

// Obtener tipos y subtipos de incidencias
export const getIssueTypes = (containerId: string) => 
  fetchAps(`${ISSUES_URL}/containers/${containerId}/issue-types`);

// Obtener definiciones de atributos personalizados
export const getCustomAttributeDefinitions = (containerId: string) => 
  fetchAps(`${ISSUES_URL}/containers/${containerId}/issue-attribute-definitions`);

// Obtener el mapeo (para saber qué atributos pertenecen a qué tipo de Issue)
export const getIssueAttributeMappings = (containerId: string) => 
  fetchAps(`${ISSUES_URL}/containers/${containerId}/issue-attribute-mappings`);