import { getAccAccessToken, queryAecDataModel } from "@tad/shared";

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

// ─── Queries ────────────────────────────────────────────────────────────────

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

// ─── Hub ID helpers ──────────────────────────────────────────────────────────

export function getConfiguredAecHubId(): string | null {
  const aecHubId = process.env.APS_HUB_AEC_ID?.trim();
  if (aecHubId) return aecHubId;
  const defaultHubId = process.env.APS_HUB_ID?.trim();
  return defaultHubId || null;
}

function resolveAecHubId(hubId?: string | null): string {
  const inputHubId = hubId?.trim();
  if (inputHubId) return inputHubId;

  const envHubId = getConfiguredAecHubId();
  if (envHubId) return envHubId;

  throw new Error(
    "hubId es requerido. Envia hubId o configura APS_HUB_AEC_ID (fallback: APS_HUB_ID)."
  );
}

// ─── Core fetch ─────────────────────────────────────────────────────────────

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

// ─── Projects ────────────────────────────────────────────────────────────────

export async function getAecProjects(
  hubId?: string | null,
  params?: {
    cursor?: string;
  }
): Promise<AecProject[]> {
  const trimmedHubId = resolveAecHubId(hubId);
  // Si es b.xxx necesita conversión; si ya es el AEC ID va directo
  const finalHubId = trimmedHubId.startsWith("b.")
    ? await getGraphQLHubId(trimmedHubId)
    : trimmedHubId;

  const cursor = params?.cursor?.trim();
  const query = cursor ? GET_PROJECTS_QUERY_PAGINATED : GET_PROJECTS_QUERY;
  const variables: Record<string, unknown> = cursor
    ? { hubId: finalHubId, cursor }
    : { hubId: finalHubId };

  const data = await aecFetch<AecProjectsResponse>(query, variables);
  return data?.projects?.results ?? [];
}

// ─── Elements by Element Group ───────────────────────────────────────────────

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

// ─── Element Groups (Models) ─────────────────────────────────────────────────

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

// ─── Elements ────────────────────────────────────────────────────────────────

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

// ─── Hub resolution (solo para b.xxx) ───────────────────────────────────────

async function getDataManagementHubName(hubId: string): Promise<string> {
  const token = await getAccAccessToken();
  const url = `https://developer.api.autodesk.com/project/v1/hubs/${encodeURIComponent(hubId)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Data Management Error (${response.status}): ${body}`);
  }

  const json = (await response.json()) as any;
  const name =
    json?.data?.attributes?.name ??
    json?.data?.attributes?.extension?.data?.name ??
    json?.data?.name;

  if (!name || !String(name).trim()) {
    throw new Error(
      `No se pudo leer el nombre del hub desde Data Management para: ${hubId}`
    );
  }

  return String(name).trim();
}

async function getDataManagementProjectName(
  classicHubId: string,
  classicProjectId: string
): Promise<string> {
  const token = await getAccAccessToken();
  const url = `https://developer.api.autodesk.com/project/v1/hubs/${encodeURIComponent(
    classicHubId
  )}/projects/${encodeURIComponent(classicProjectId)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Data Management Error (${response.status}): ${body}`);
  }

  const json = (await response.json()) as any;
  const name =
    json?.data?.attributes?.name ??
    json?.data?.attributes?.extension?.data?.name ??
    json?.data?.name;

  if (!name || !String(name).trim()) {
    throw new Error(
      `No se pudo leer el nombre del proyecto desde Data Management para: ${classicProjectId}`
    );
  }

  return String(name).trim();
}

export async function getGraphQLHubId(classicHubId: string): Promise<string> {
  const dmName = await getDataManagementHubName(classicHubId);

  // Busca el hub AEC por nombre usando la query de proyectos del AEC
  // (el API AEC no tiene query de hubs, se resuelve por nombre)
  throw new Error(
    `El hub '${classicHubId}' es un hubId de Data Management (b.xxx). ` +
    `Configura APS_HUB_AEC_ID con el hubId GraphQL de AEC directamente (urn:adsk.ace:...).`
  );
}

export async function getGraphQLProjectId(
  classicHubId: string | null | undefined,
  projectId: string
): Promise<string> {
  const trimmedProjectId = projectId.trim();
  if (!trimmedProjectId.startsWith("b.")) {
    return trimmedProjectId;
  }

  const trimmedHubId = resolveAecHubId(classicHubId);
  if (!trimmedHubId.startsWith("b.")) {
    throw new Error(
      "Para convertir projectId b.xxx se requiere hubId b.xxx (input o APS_HUB_AEC_ID)."
    );
  }

  const projects = await getAecProjects(trimmedHubId);
  const normalizedClassicProjectId = trimmedProjectId.toLowerCase();
  const matchByAlternativeId = projects.find(
    (project) =>
      project.alternativeIdentifiers?.dataManagementAPIProjectId
        ?.trim()
        .toLowerCase() === normalizedClassicProjectId
  );

  if (matchByAlternativeId) {
    return matchByAlternativeId.id;
  }

  const projectName = await getDataManagementProjectName(trimmedHubId, trimmedProjectId);
  const matches = projects.filter(
    (project) => project.name.trim().toLowerCase() === projectName.toLowerCase()
  );

  if (matches.length === 1) {
    return matches[0].id;
  }

  if (matches.length === 0) {
    const sample = projects
      .slice(0, 20)
      .map((project) => `- ${project.name} -> ${project.id}`)
      .join("\n");

    throw new Error(
      `No se encontro el proyecto '${projectName}' en AEC Data Model.\n` +
        `Proyectos visibles:\n${sample}`
    );
  }

  throw new Error(
    `Se encontraron ${matches.length} proyectos con el nombre '${projectName}'. Usa el projectId GraphQL directamente.`
  );
}