import { queryAecDataModel } from "@tad/shared";

type AecEntity = { id: string; name: string };
type AecProjectAlternativeIdentifiers = {
  dataManagementAPIProjectId?: string | null;
};
export type AecProject = AecEntity & {
  alternativeIdentifiers?: AecProjectAlternativeIdentifiers | null;
};
type AecProperty = {
  name: string;
  value?: string | null;
  displayValue?: string | null;
  description?: string | null;
};
type AecElement = {
  id: string;
  name: string;
  properties?: { results?: AecProperty[] | null } | null;
};

export type AecHubsResponse = {
  hubs: { results: AecEntity[] };
};

export type AecProjectsResponse = {
  projects: {
    pagination: { cursor?: string | null };
    results: AecProject[];
  };
};

export type AecElementsByProjectResponse = {
  elementsByProject: { results: AecElement[] };
};

export type AecElementGroup = {
  id: string;
  name: string;
  alternativeIdentifiers?: {
    fileUrn?: string | null;
    fileVersionUrn?: string | null;
  } | null;
};

export type AecElementGroupsResponse = {
  elementGroupsByProject: {
    pagination: { cursor?: string | null };
    results: AecElementGroup[];
  };
};

export type AecElementGroupElement = {
  id: string;
  name: string;
  alternativeIdentifiers?: {
    revitElementId?: string | null;
    externalElementId?: string | null;
  } | null;
  properties?: {
    results?: {
      name: string;
      value?: string | number | boolean | null;
      definition?: {
        id?: string | null;
        name?: string | null;
        description?: string | null;
        specification?: string | null;
      } | null;
    }[] | null;
  } | null;
};

export type AecElementsByElementGroupResponse = {
  elementsByElementGroup: {
    pagination: { cursor?: string | null };
    results: AecElementGroupElement[];
  };
};

// --- Queries ----------------------------------------------------------------

export const GET_PROJECTS_QUERY = `
  query GetProjects($hubId: ID!) {
    projects(hubId: $hubId) {
      pagination { cursor }
      results {
        id
        name
        alternativeIdentifiers {
          dataManagementAPIProjectId
        }
      }
    }
  }
`;

export const GET_PROJECTS_QUERY_PAGINATED = `
  query GetProjectsPaginated($hubId: ID!, $cursor: String!) {
    projects(hubId: $hubId, pagination: { cursor: $cursor }) {
      pagination { cursor }
      results {
        id
        name
        alternativeIdentifiers {
          dataManagementAPIProjectId
        }
      }
    }
  }
`;

export const GET_ELEMENTS_BY_PROJECT_QUERY = `
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

export const GET_ELEMENTS_BY_ELEMENT_GROUP_QUERY = `
  query GetElementsFromElementGroup($elementGroupId: ID!, $propertyFilter: String, $cursor: String) {
    elementsByElementGroup(
      elementGroupId: $elementGroupId,
      filter: { query: $propertyFilter },
      pagination: { cursor: $cursor, limit: 500 }
    ) {
      pagination { cursor }
      results {
        id
        name
        alternativeIdentifiers {
          revitElementId
          externalElementId
        }
        properties {
          results {
            name
            value
            definition {
              id
              name
              description
              specification
            }
          }
        }
      }
    }
  }
`;

export const GET_ELEMENTS_BY_PROJECT_QUERY_PAGINATED = `
  query GetElementsByProjectPaginated($projectId: ID!, $filter: ElementFilterInput, $cursor: String!) {
    elementsByProject(projectId: $projectId, filter: $filter, pagination: { cursor: $cursor }) {
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

export const GET_ELEMENT_GROUPS_BY_PROJECT_QUERY = `
  query GetElementGroupsByProject($projectId: ID!) {
    elementGroupsByProject(projectId: $projectId) {
      pagination { cursor }
      results {
        id
        name
        alternativeIdentifiers {
          fileUrn
          fileVersionUrn
        }
      }
    }
  }
`;

export const GET_ELEMENT_GROUPS_BY_PROJECT_QUERY_PAGINATED = `
  query GetElementGroupsByProjectPaginated($projectId: ID!, $cursor: String!) {
    elementGroupsByProject(projectId: $projectId, pagination: { cursor: $cursor }) {
      pagination { cursor }
      results {
        id
        name
        alternativeIdentifiers {
          fileUrn
          fileVersionUrn
        }
      }
    }
  }
`;

// --- Hub ID helpers ----------------------------------------------------------

export function getConfiguredAecHubId(): string | null {
  const aecHubId = process.env.APS_HUB_AEC_ID?.trim();
  if (aecHubId) return aecHubId;
  const defaultHubId = process.env.APS_HUB_ID?.trim();
  return defaultHubId || null;
}

function resolveAecHubId(hubId?: string | null): string {
  const inputHubId = hubId?.trim();
  if (inputHubId) {
    if (!inputHubId.toLowerCase().startsWith("urn:")) {
      throw new Error(
        "hubId para AEC Data Model debe iniciar con 'urn:' (ej: urn:adsk.ace:...)."
      );
    }
    return inputHubId;
  }

  const envHubId = getConfiguredAecHubId();
  if (envHubId) {
    if (!envHubId.toLowerCase().startsWith("urn:")) {
      throw new Error(
        "APS_HUB_AEC_ID debe iniciar con 'urn:' (ej: urn:adsk.ace:...)."
      );
    }
    return envHubId;
  }

  throw new Error(
    "hubId es requerido. Envia hubId o configura APS_HUB_AEC_ID con formato urn:."
  );
}

// --- Core fetch -------------------------------------------------------------

export async function aecFetch<TData = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<TData> {
  const response = await queryAecDataModel(query, variables);

  if (response?.errors?.length) {
    throw new Error(`GraphQL Error: ${JSON.stringify(response.errors)}`);
  }

  return response.data as TData;
}

// --- Projects ----------------------------------------------------------------

export async function getAecProjects(
  hubId?: string | null,
  params?: {
    cursor?: string;
  }
): Promise<AecProject[]> {
  const finalHubId = resolveAecHubId(hubId);

  const cursor = params?.cursor?.trim();
  const query = cursor ? GET_PROJECTS_QUERY_PAGINATED : GET_PROJECTS_QUERY;
  const variables: Record<string, unknown> = cursor
    ? { hubId: finalHubId, cursor }
    : { hubId: finalHubId };

  const data = await aecFetch<AecProjectsResponse>(query, variables);
  return data?.projects?.results ?? [];
}

// --- Elements by Element Group -----------------------------------------------

export async function getAecElementsByElementGroup(
  elementGroupId: string,
  params?: {
    propertyFilter?: string;
    cursor?: string;
  }
): Promise<AecElementGroupElement[]> {
  const all: AecElementGroupElement[] = [];
  const seenCursors = new Set<string>();
  let cursor = params?.cursor?.trim() || null;

  while (true) {
    const variables: Record<string, unknown> = {
      elementGroupId: elementGroupId.trim(),
      propertyFilter: params?.propertyFilter?.trim() || null,
      cursor: cursor || null,
    };

    const data = await aecFetch<AecElementsByElementGroupResponse>(
      GET_ELEMENTS_BY_ELEMENT_GROUP_QUERY,
      variables
    );

    const results = data?.elementsByElementGroup?.results ?? [];
    all.push(...results);

    const nextCursor = data?.elementsByElementGroup?.pagination?.cursor ?? null;
    if (!nextCursor || seenCursors.has(nextCursor)) break;
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  return all;
}

// --- Element Groups (Models) -------------------------------------------------

export async function getAecElementGroupsByProject(
  projectId: string,
  params?: {
    cursor?: string;
  }
): Promise<AecElementGroup[]> {
  const cursor = params?.cursor?.trim();
  const query = cursor
    ? GET_ELEMENT_GROUPS_BY_PROJECT_QUERY_PAGINATED
    : GET_ELEMENT_GROUPS_BY_PROJECT_QUERY;
  const variables: Record<string, unknown> = cursor
    ? { projectId: projectId.trim(), cursor }
    : { projectId: projectId.trim() };

  const data = await aecFetch<AecElementGroupsResponse>(query, variables);
  return data?.elementGroupsByProject?.results ?? [];
}

// --- Elements ----------------------------------------------------------------

export async function getAecElementsByProject(
  projectId: string,
  params?: {
    filterQuery?: string;
    cursor?: string;
  }
): Promise<AecElement[]> {
  const filter = params?.filterQuery?.trim()
    ? { query: params.filterQuery.trim() }
    : undefined;

  const cursor = params?.cursor?.trim();
  const query = cursor ? GET_ELEMENTS_BY_PROJECT_QUERY_PAGINATED : GET_ELEMENTS_BY_PROJECT_QUERY;
  const variables: Record<string, unknown> = cursor
    ? { projectId: projectId.trim(), filter, cursor }
    : { projectId: projectId.trim(), filter };

  const data = await aecFetch<AecElementsByProjectResponse>(query, variables);
  return data?.elementsByProject?.results ?? [];
}


