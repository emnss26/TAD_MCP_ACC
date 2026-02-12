const GET_ELEMENTS_QUERY = `
  query GetElementsByProject($projectId: ID!, $filter: ElementFilterInput) {
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

// Tool: aec_get_element_data
// Input: projectId (GraphQL ID), filter (ej: "type === 'w01' && category === 'Walls'")