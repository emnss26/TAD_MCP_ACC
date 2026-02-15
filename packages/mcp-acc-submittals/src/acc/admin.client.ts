import { fetchApsJson } from "@tad/shared";

const ADMIN_URL = "https://developer.api.autodesk.com/construction/admin/v1";

export const getProjectUsers = (projectId: string) =>
  fetchApsJson(`${ADMIN_URL}/projects/${projectId}/users`, {
    serviceName: "submittals.admin.getProjectUsers"
  });

export const getProjectCompanies = (projectId: string) =>
  fetchApsJson(`${ADMIN_URL}/projects/${projectId}/companies`, {
    serviceName: "submittals.admin.getProjectCompanies"
  });
