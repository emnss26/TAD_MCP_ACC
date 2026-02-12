import { queryAecDataModel } from "@tad/shared";

// Query para encontrar el Project ID de GraphQL (base64) usando el hubId de REST
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

// Query maestra para cantidades y propiedades
export const GET_ELEMENT_DATA_QUERY = `
  query GetElementData($projectId: ID!, $filter: ElementFilterInput) {
    elementsByProject(projectId: $projectId, filter: $filter) {
      results {
        id
        name
        properties {
          results {
            name
            value
            displayValue
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