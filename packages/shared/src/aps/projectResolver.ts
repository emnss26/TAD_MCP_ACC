import { getHubProjects, type HubProject } from "./accAdmin.js";

export type ProjectResolutionSource =
  | "input.projectId"
  | "input.projectName";

export type ResolveProjectInput = {
  projectId?: string | null;
  projectName?: string | null;
  hubId?: string | null;
  envHubId?: string | null;
  normalizeProjectId?: (projectId: string) => string;
};

export type ResolveProjectResult = {
  source: ProjectResolutionSource;
  hubId: string | null;
  requestedProjectName: string | null;
  resolvedProjectName: string | null;
  rawProjectId: string;
  projectId: string;
};

export function normalizeProjectIdForConstruction(projectId: string): string {
  return projectId.trim().replace(/^b\./i, "");
}

function getProjectName(project: HubProject): string {
  return String(project?.attributes?.name ?? "").trim();
}

function formatProjectList(projects: HubProject[], limit = 12): string {
  return projects
    .slice(0, limit)
    .map((project) => `- ${getProjectName(project) || "(sin nombre)"} (${project.id})`)
    .join("\n");
}

function normalizeProjectId(
  projectId: string,
  normalizeFn?: (projectId: string) => string
): string {
  if (normalizeFn) {
    return normalizeFn(projectId);
  }
  return projectId.trim();
}

export async function resolveProject(
  input: ResolveProjectInput
): Promise<ResolveProjectResult> {
  const envHubId = input.envHubId?.trim() || process.env.APS_HUB_ID?.trim() || null;
  const effectiveHubId = input.hubId?.trim() || envHubId;

  const inputProjectId = input.projectId?.trim();
  if (inputProjectId) {
    return {
      source: "input.projectId",
      hubId: effectiveHubId,
      requestedProjectName: null,
      resolvedProjectName: null,
      rawProjectId: inputProjectId,
      projectId: normalizeProjectId(inputProjectId, input.normalizeProjectId)
    };
  }

  const requestedProjectName = input.projectName?.trim();
  if (requestedProjectName) {
    if (!effectiveHubId) {
      throw new Error(
        "Para resolver projectName se requiere hubId (input) o APS_HUB_ID (entorno)."
      );
    }

    const projects = await getHubProjects(effectiveHubId);
    if (projects.length === 0) {
      throw new Error(`No se encontraron proyectos para el hub '${effectiveHubId}'.`);
    }

    const needle = requestedProjectName.toLowerCase();
    const exactMatches = projects.filter(
      (project) => getProjectName(project).toLowerCase() === needle
    );

    if (exactMatches.length === 1) {
      const rawProjectId = exactMatches[0].id;
      return {
        source: "input.projectName",
        hubId: effectiveHubId,
        requestedProjectName,
        resolvedProjectName: getProjectName(exactMatches[0]),
        rawProjectId,
        projectId: normalizeProjectId(rawProjectId, input.normalizeProjectId)
      };
    }

    if (exactMatches.length > 1) {
      throw new Error(
        `Hay ${exactMatches.length} proyectos con nombre exacto '${requestedProjectName}'. Usa projectId.\n${formatProjectList(exactMatches, 10)}`
      );
    }

    const partialMatches = projects.filter((project) =>
      getProjectName(project).toLowerCase().includes(needle)
    );

    if (partialMatches.length === 1) {
      const rawProjectId = partialMatches[0].id;
      return {
        source: "input.projectName",
        hubId: effectiveHubId,
        requestedProjectName,
        resolvedProjectName: getProjectName(partialMatches[0]),
        rawProjectId,
        projectId: normalizeProjectId(rawProjectId, input.normalizeProjectId)
      };
    }

    if (partialMatches.length === 0) {
      throw new Error(
        `No se encontro el proyecto '${requestedProjectName}' en el hub '${effectiveHubId}'.\nProyectos visibles:\n${formatProjectList(projects)}`
      );
    }

    throw new Error(
      `Hay ${partialMatches.length} coincidencias para '${requestedProjectName}'. Especifica mejor el nombre o usa projectId.\n${formatProjectList(partialMatches, 10)}`
    );
  }

  throw new Error(
    "Debes enviar projectId o projectName para identificar el proyecto."
  );
}
