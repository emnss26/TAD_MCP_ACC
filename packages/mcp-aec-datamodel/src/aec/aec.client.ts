import { getAccAccessToken, queryAecDataModel } from "@tad/shared";

type AecEntity = { id: string; name: string };
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
type QueryFilter = { query: string };
type PaginationInput = { pageSize?: number; cursor?: string };

export type AecHubsResponse = {
  hubs: { results: AecEntity[] };
};

export type AecProjectsResponse = {
  projects: { results: AecEntity[] };
};

export type AecElementsByProjectResponse = {
  elementsByProject: { results: AecElement[] };
};

export const GET_HUBS_QUERY = `
  query GetHubs($filter: HubFilterInput, $pagination: PaginationInput) {
    hubs(filter: $filter, pagination: $pagination) {
      results {
        id
        name
      }
    }
  }
`;

export const GET_PROJECTS_QUERY = `
  query GetProjects($hubId: ID!, $filter: ProjectFilterInput, $pagination: PaginationInput) {
    projects(hubId: $hubId, filter: $filter, pagination: $pagination) {
      results {
        id
        name
      }
    }
  }
`;

export const GET_ELEMENTS_BY_PROJECT_QUERY = `
  query GetElementsByProject($projectId: ID!, $filter: ElementFilterInput, $pagination: PaginationInput) {
    elementsByProject(projectId: $projectId, filter: $filter, pagination: $pagination) {
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

export const GET_ELEMENT_DETAILS_QUERY = GET_ELEMENTS_BY_PROJECT_QUERY;

function buildFilter(filterQuery?: string): QueryFilter | undefined {
  const query = filterQuery?.trim();
  return query ? { query } : undefined;
}

function buildPagination(
  pageSize?: number,
  cursor?: string
): PaginationInput | undefined {
  const hasPageSize = typeof pageSize === "number";
  const hasCursor = Boolean(cursor?.trim());
  if (!hasPageSize && !hasCursor) return undefined;

  return {
    ...(hasPageSize ? { pageSize } : {}),
    ...(hasCursor ? { cursor: cursor!.trim() } : {}),
  };
}

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

export async function getAecHubs(params?: {
  filterQuery?: string;
  pageSize?: number;
  cursor?: string;
}): Promise<AecEntity[]> {
  const data = await aecFetch<AecHubsResponse>(GET_HUBS_QUERY, {
    filter: buildFilter(params?.filterQuery),
    pagination: buildPagination(params?.pageSize, params?.cursor),
  });

  return data?.hubs?.results ?? [];
}

export async function getAecProjects(
  hubId: string,
  params?: {
    filterQuery?: string;
    pageSize?: number;
    cursor?: string;
  }
): Promise<AecEntity[]> {
  const trimmedHubId = hubId.trim();
  const finalHubId = trimmedHubId.startsWith("b.")
    ? await getGraphQLHubId(trimmedHubId)
    : trimmedHubId;

  const data = await aecFetch<AecProjectsResponse>(GET_PROJECTS_QUERY, {
    hubId: finalHubId,
    filter: buildFilter(params?.filterQuery),
    pagination: buildPagination(params?.pageSize, params?.cursor),
  });

  return data?.projects?.results ?? [];
}

export async function getAecElementsByProject(
  projectId: string,
  params?: {
    filterQuery?: string;
    pageSize?: number;
    cursor?: string;
  }
): Promise<AecElement[]> {
  const data = await aecFetch<AecElementsByProjectResponse>(
    GET_ELEMENTS_BY_PROJECT_QUERY,
    {
      projectId: projectId.trim(),
      filter: buildFilter(params?.filterQuery),
      pagination: buildPagination(params?.pageSize, params?.cursor),
    }
  );

  return data?.elementsByProject?.results ?? [];
}

async function getDataManagementHubName(hubId: string): Promise<string> {
  const token = await getAccAccessToken();
  const url = `https://developer.api.autodesk.com/project/v1/hubs/${encodeURIComponent(
    hubId
  )}`;

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
  const hubs = await getAecHubs();
  const matches = hubs.filter(
    (hub) => hub.name.trim().toLowerCase() === dmName.toLowerCase()
  );

  if (matches.length === 1) {
    return matches[0].id;
  }

  if (matches.length === 0) {
    const sample = hubs
      .slice(0, 12)
      .map((hub) => `- ${hub.name} -> ${hub.id}`)
      .join("\n");

    throw new Error(
      `No se encontro el hub en AEC Data Model para '${dmName}' (hubId=${classicHubId}).\n` +
        `Hubs visibles en AEC Data Model:\n${sample}`
    );
  }

  throw new Error(
    `Se encontraron ${matches.length} hubs con el nombre '${dmName}'. Usa el hubId GraphQL directamente.`
  );
}

export async function getGraphQLProjectId(
  classicHubId: string,
  projectId: string
): Promise<string> {
  const trimmedProjectId = projectId.trim();
  if (!trimmedProjectId.startsWith("b.")) {
    return trimmedProjectId;
  }

  const trimmedHubId = classicHubId.trim();
  if (!trimmedHubId.startsWith("b.")) {
    throw new Error(
      "Para convertir projectId b.xxx se requiere hubId b.xxx de Data Management."
    );
  }

  const projectName = await getDataManagementProjectName(
    trimmedHubId,
    trimmedProjectId
  );
  const projects = await getAecProjects(trimmedHubId);
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
