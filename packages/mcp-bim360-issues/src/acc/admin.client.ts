import { fetchApsJson } from "@tad/shared";

const ISSUES_URL = "https://developer.api.autodesk.com/issues/v2";

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
