// packages/mcp-aec-datamodel/src/tools/aec.get.projects.ts
const GET_PROJECTS_QUERY = `
  query GetProjects($hubId: String!) {
    projects(hubId: $hubId) {
      results {
        id
        name
      }
    }
  }
`;

// Tool: aec_get_projects (Recibe hubId, devuelve lista de nombres e IDs GraphQL)