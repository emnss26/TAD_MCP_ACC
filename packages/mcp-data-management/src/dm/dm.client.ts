import { getAccAccessToken } from "@tad/shared";

const BASE_URL = "https://developer.api.autodesk.com/project/v1";

export async function getHubProjects(hubId: string) {
  const token = await getAccAccessToken();
  const res = await fetch(`${BASE_URL}/hubs/${hubId}/projects`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) throw new Error(`Error fetching projects: ${res.statusText}`);
  const data = await res.json();
  return data.data; // Retorna la lista de proyectos
}

export async function getProjectDetails(hubId: string, projectId: string) {
  const token = await getAccAccessToken();
  const res = await fetch(`${BASE_URL}/hubs/${hubId}/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) throw new Error(`Error fetching project details: ${res.statusText}`);
  return await res.json();
}