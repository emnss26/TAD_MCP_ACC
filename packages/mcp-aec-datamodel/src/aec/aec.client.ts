import { queryAecDataModel } from "@tad/shared";

// Query para encontrar el Project ID de GraphQL (base64)
export const GET_PROJECTS_QUERY = `
  query GetProjects($hubId: String!) {
    projects(hubId: $hubId) {
      results {
        id
        name
      }
    }
  }
`;

// Query Maestra: Extrae elementos y TODAS sus propiedades técnicas
export const GET_ELEMENT_DETAILS_QUERY = `
  query GetElementDetails($projectId: ID!, $filter: ElementFilterInput) {
    elementsByProject(projectId: $projectId, filter: $filter) {
      results {
        id
        name
        properties {
          results {
            name
            value
            displayValue
            description
          }
        }
      }
    }
  }
`;

export async function aecFetch(query: string, variables: any) {
  const res = await queryAecDataModel(query, variables);
  if (res.errors) {
    throw new Error(`GraphQL Error: ${JSON.stringify(res.errors)}`);
  }
  return res.data;
}