import { fetchApsJson } from "./http.js";

const ADMIN_URL = "https://developer.api.autodesk.com/construction/admin/v1";
const PROJECT_URL = "https://developer.api.autodesk.com/project/v1";

export type HubProject = {
  id: string;
  attributes?: { name?: string };
};

/**
 * Gets users linked to a specific ACC project.
 */
export const getProjectUsers = (projectId: string) =>
  fetchApsJson(`${ADMIN_URL}/projects/${projectId}/users`, {
    serviceName: "shared.accAdmin.getProjectUsers"
  });

/**
 * Gets companies linked to a specific ACC project.
 */
export const getProjectCompanies = (projectId: string) =>
  fetchApsJson(`${ADMIN_URL}/projects/${projectId}/companies`, {
    serviceName: "shared.accAdmin.getProjectCompanies"
  });

/**
 * Lists projects available inside a Hub (Data Management API).
 */
export async function getHubProjects(hubId: string): Promise<HubProject[]> {
  const data = await fetchApsJson(
    `${PROJECT_URL}/hubs/${encodeURIComponent(hubId)}/projects`,
    { serviceName: "shared.accAdmin.getHubProjects" }
  );
  return Array.isArray((data as any)?.data) ? (data as any).data : [];
}
