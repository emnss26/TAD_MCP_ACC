import { fetchApsJson } from "@tad/shared";

const ADMIN_URL = "https://developer.api.autodesk.com/construction/admin/v1";
const ISSUES_URL = "https://developer.api.autodesk.com/issues/v1";

// Obtener usuarios del proyecto (para mapear assignedTo, createdBy, etc.)
export const getProjectUsers = (projectId: string) =>
  fetchApsJson(`${ADMIN_URL}/projects/${projectId}/users`, {
    serviceName: "issues.admin.getProjectUsers"
  });

// Obtener empresas del proyecto
export const getProjectCompanies = (projectId: string) =>
  fetchApsJson(`${ADMIN_URL}/projects/${projectId}/companies`, {
    serviceName: "issues.admin.getProjectCompanies"
  });

// Obtener tipos y subtipos de incidencias
export const getIssueTypes = (containerId: string) =>
  fetchApsJson(`${ISSUES_URL}/containers/${containerId}/issue-types`, {
    serviceName: "issues.admin.getIssueTypes"
  });

// Obtener definiciones de atributos personalizados
export const getCustomAttributeDefinitions = (containerId: string) =>
  fetchApsJson(
    `${ISSUES_URL}/containers/${containerId}/issue-attribute-definitions`,
    { serviceName: "issues.admin.getCustomAttributeDefinitions" }
  );

// Obtener el mapeo (para saber qué atributos pertenecen a qué tipo de Issue)
export const getIssueAttributeMappings = (containerId: string) =>
  fetchApsJson(
    `${ISSUES_URL}/containers/${containerId}/issue-attribute-mappings`,
    { serviceName: "issues.admin.getIssueAttributeMappings" }
  );
