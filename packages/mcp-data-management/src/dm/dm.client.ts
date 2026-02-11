import { getAccAccessToken } from "@tad/shared";

const BASE_URL = "https://developer.api.autodesk.com/project/v1";
const DATA_URL = "https://developer.api.autodesk.com/data/v1";

export async function getHubProjects(hubId: string) {
  const token = await getAccAccessToken();
  const res = await fetch(`${BASE_URL}/hubs/${hubId}/projects`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Error APS (Projects): ${res.status}`);
  const data = await res.json();
  return data.data;
}

// NUEVA: Obtener detalle del proyecto (donde vienen los relationships)
export async function getProjectDetails(hubId: string, projectId: string) {
  const token = await getAccAccessToken();
  const res = await fetch(`${BASE_URL}/hubs/${hubId}/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Error APS (Project Details): ${res.status}`);
  return await res.json();
}

// NUEVA: Listar contenido de una carpeta (archivos y subcarpetas)
export async function getFolderContents(projectId: string, folderId: string) {
  const token = await getAccAccessToken();
  const res = await fetch(`${DATA_URL}/projects/${projectId}/folders/${folderId}/contents`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Error APS (Folder Contents): ${res.status}`);
  return await res.json();
}
