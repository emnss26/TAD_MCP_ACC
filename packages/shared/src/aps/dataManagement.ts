import { URL } from "node:url";
import { fetchApsJson } from "./http.js";

const PROJECT_URL = "https://developer.api.autodesk.com/project/v1";
const DATA_URL = "https://developer.api.autodesk.com/data/v1";

type QueryValue = string | number | boolean | null | undefined;

function withQuery(baseUrl: string, query: Record<string, QueryValue> = {}) {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export function normalizeProjectIdWithB(projectId: string): string {
  const id = projectId.trim();
  return id.startsWith("b.") ? id : `b.${id}`;
}

export function normalizeProjectIdWithoutB(projectId: string): string {
  return projectId.trim().replace(/^b\./i, "");
}

function normalizeHubIdVariants(hubId: string): string[] {
  const raw = hubId.trim();
  const variants = [raw];
  if (raw.startsWith("b.")) {
    variants.push(raw.replace(/^b\./i, ""));
  } else {
    variants.push(`b.${raw}`);
  }
  return [...new Set(variants)];
}

function shouldTryNextHubVariant(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const statusMatch = error.message.match(/\((\d{3})\)/);
  if (!statusMatch) return false;
  const status = Number(statusMatch[1]);
  return status === 400 || status === 404;
}

async function fetchWithHubVariants<T>(
  hubId: string,
  buildUrl: (hubIdVariant: string) => string,
  serviceName: string
): Promise<T> {
  const variants = normalizeHubIdVariants(hubId);
  let lastError: unknown = null;

  for (let i = 0; i < variants.length; i += 1) {
    const variant = variants[i];
    try {
      return await fetchApsJson<T>(buildUrl(variant), { serviceName });
    } catch (error) {
      lastError = error;
      if (i < variants.length - 1 && shouldTryNextHubVariant(error)) {
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error(`[${serviceName}] No se pudo resolver hubId.`);
}

export async function getProjectTopFolders(params: {
  hubId: string;
  projectId: string;
  query?: Record<string, QueryValue>;
}) {
  const projectIdWithB = normalizeProjectIdWithB(params.projectId);

  return fetchWithHubVariants(
    params.hubId,
    (hubIdVariant) =>
      withQuery(
        `${PROJECT_URL}/hubs/${encodeURIComponent(
          hubIdVariant
        )}/projects/${encodeURIComponent(projectIdWithB)}/topFolders`,
        params.query
      ),
    "shared.dataManagement.getProjectTopFolders"
  );
}

export async function getFolderDetails(params: {
  projectId: string;
  folderId: string;
}) {
  const projectIdWithB = normalizeProjectIdWithB(params.projectId);
  return fetchApsJson(
    `${DATA_URL}/projects/${encodeURIComponent(
      projectIdWithB
    )}/folders/${encodeURIComponent(params.folderId)}`,
    { serviceName: "shared.dataManagement.getFolderDetails" }
  );
}

export async function getFolderContents(params: {
  projectId: string;
  folderId: string;
  query?: Record<string, QueryValue>;
}) {
  const projectIdWithB = normalizeProjectIdWithB(params.projectId);
  return fetchApsJson(
    withQuery(
      `${DATA_URL}/projects/${encodeURIComponent(
        projectIdWithB
      )}/folders/${encodeURIComponent(params.folderId)}/contents`,
      params.query
    ),
    { serviceName: "shared.dataManagement.getFolderContents" }
  );
}

export async function getItemDetails(params: {
  projectId: string;
  itemId: string;
}) {
  const projectIdWithB = normalizeProjectIdWithB(params.projectId);
  return fetchApsJson(
    `${DATA_URL}/projects/${encodeURIComponent(
      projectIdWithB
    )}/items/${encodeURIComponent(params.itemId)}`,
    { serviceName: "shared.dataManagement.getItemDetails" }
  );
}

export async function getVersionDetails(params: {
  projectId: string;
  versionId: string;
}) {
  const projectIdWithB = normalizeProjectIdWithB(params.projectId);
  return fetchApsJson(
    `${DATA_URL}/projects/${encodeURIComponent(
      projectIdWithB
    )}/versions/${encodeURIComponent(params.versionId)}`,
    { serviceName: "shared.dataManagement.getVersionDetails" }
  );
}
