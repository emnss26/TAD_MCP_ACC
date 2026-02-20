import { URL } from "node:url";
import { fetchApsJson } from "@tad/shared";

const SHEETS_BASE_URL = "https://developer.api.autodesk.com/construction/sheets/v1";

type QueryValue = string | number | boolean | null | undefined;

type ListParams = {
  token: string;
  projectId: string;
  limit: number;
  offset: number;
  query?: Record<string, QueryValue>;
};

type GetCollectionParams = {
  token: string;
  projectId: string;
  collectionId: string;
  query?: Record<string, QueryValue>;
};

function appendQuery(url: URL, query: Record<string, QueryValue> = {}) {
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }
}

export async function listCollections(params: ListParams) {
  const { token, projectId, limit, offset, query } = params;
  const url = new URL(`${SHEETS_BASE_URL}/projects/${projectId}/collections`);
  appendQuery(url, { ...query, limit, offset });

  return fetchApsJson(url.toString(), {
    token,
    serviceName: "sheets.listCollections"
  });
}

export async function getCollection(params: GetCollectionParams) {
  const { token, projectId, collectionId, query } = params;
  const url = new URL(
    `${SHEETS_BASE_URL}/projects/${projectId}/collections/${collectionId}`
  );
  appendQuery(url, query);

  return fetchApsJson(url.toString(), {
    token,
    serviceName: "sheets.getCollection"
  });
}

export async function listSheets(params: ListParams) {
  const { token, projectId, limit, offset, query } = params;
  const url = new URL(`${SHEETS_BASE_URL}/projects/${projectId}/sheets`);
  appendQuery(url, { ...query, limit, offset });

  return fetchApsJson(url.toString(), {
    token,
    serviceName: "sheets.listSheets"
  });
}

export async function listVersionSets(params: ListParams) {
  const { token, projectId, limit, offset, query } = params;
  const url = new URL(`${SHEETS_BASE_URL}/projects/${projectId}/version-sets`);
  appendQuery(url, { ...query, limit, offset });

  return fetchApsJson(url.toString(), {
    token,
    serviceName: "sheets.listVersionSets"
  });
}
