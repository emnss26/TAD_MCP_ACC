import { fetchApsJson } from "@tad/shared";

const ADMIN_URL = "https://developer.api.autodesk.com/construction/admin/v1";

// Obtener usuarios del proyecto (para mapear assignedTo, createdBy, etc.)
export const getProjectUsers = (projectId: string) =>
  fetchApsJson(`${ADMIN_URL}/projects/${projectId}/users`, {
    serviceName: "rfis.admin.getProjectUsers"
  });

// Obtener empresas del proyecto
export const getProjectCompanies = (projectId: string) =>
  fetchApsJson(`${ADMIN_URL}/projects/${projectId}/companies`, {
    serviceName: "rfis.admin.getProjectCompanies"
  });
