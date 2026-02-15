import { URL } from "node:url";
import { fetchApsJson } from "@tad/shared";

type RfiListParams = {
  token: string;
  projectId: string;
  limit: number;
  offset: number;
};

type RfiContextParams = {
  token: string;
  projectId: string;
};

type CreateRfiParams = {
  token: string;
  projectId: string;
  payload: Record<string, unknown>;
  region?: string;
};

const RFIS_BASE_URL = "https://developer.api.autodesk.com/construction/rfis/v3";

export async function listRfis(params: RfiListParams) {
  const { token, projectId, limit, offset } = params;
  const url = new URL(`${RFIS_BASE_URL}/projects/${projectId}/rfis`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  return fetchApsJson(url.toString(), {
    token,
    serviceName: "rfis.listRfis"
  });
}

export async function getRfiTypes(params: RfiContextParams) {
  const { token, projectId } = params;
  return fetchApsJson(`${RFIS_BASE_URL}/projects/${projectId}/rfi-types`, {
    token,
    serviceName: "rfis.getRfiTypes"
  });
}

export async function getRfiAttributes(params: RfiContextParams) {
  const { token, projectId } = params;
  return fetchApsJson(`${RFIS_BASE_URL}/projects/${projectId}/attributes`, {
    token,
    serviceName: "rfis.getRfiAttributes"
  });
}

export async function createRfi(params: CreateRfiParams) {
  const { token, projectId, payload, region } = params;
  return fetchApsJson(`${RFIS_BASE_URL}/projects/${projectId}/rfis`, {
    method: "POST",
    token,
    headers: region ? { Region: region } : undefined,
    body: payload,
    serviceName: "rfis.createRfi"
  });
}
