import { getAccAccessToken } from "@tad/shared";

const BASE_URL = "https://developer.api.autodesk.com/project/v1";
const DATA_URL = "https://developer.api.autodesk.com/data/v1";

async function fetchAps(url: string) {
  const token = await getAccAccessToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Error APS (${res.status}): ${res.statusText}`);
  return await res.json();
}

export const getHubProjects = (hubId: string) => 
  fetchAps(`${BASE_URL}/hubs/${hubId}/projects`).then(r => r.data);

export const getProjectDetails = (hubId: string, projectId: string) => 
  fetchAps(`${BASE_URL}/hubs/${hubId}/projects/${projectId}`);

export const getFolderContents = (projectId: string, folderId: string) => 
  fetchAps(`${DATA_URL}/projects/${projectId}/folders/${folderId}/contents`);

export const getItemVersions = (projectId: string, itemId: string) => 
  fetchAps(`${DATA_URL}/projects/${projectId}/items/${itemId}/versions`);