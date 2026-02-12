import { getAccAccessToken } from "./accAuth.js";

const ADMIN_URL = "https://developer.api.autodesk.com/construction/admin/v1";

async function fetchAdmin(url: string) {
  const token = await getAccAccessToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Error APS Admin (${res.status}): ${res.statusText}`);
  return await res.json();
}

/**
 * Obtiene los usuarios vinculados a un proyecto específico.
 */
export const getProjectUsers = (projectId: string) => 
  fetchAdmin(`${ADMIN_URL}/projects/${projectId}/users`);

/**
 * Obtiene las empresas vinculadas a un proyecto específico.
 */
export const getProjectCompanies = (projectId: string) => 
  fetchAdmin(`${ADMIN_URL}/projects/${projectId}/companies`);