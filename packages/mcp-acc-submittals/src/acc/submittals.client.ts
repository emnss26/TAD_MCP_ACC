import { URL } from "node:url";
import { fetchApsJson } from "@tad/shared";

type SubmittalListParams = {
  token: string;
  projectId: string;
  limit: number;
  offset: number;
};

type SubmittalContextParams = {
  token: string;
  projectId: string;
};

type SubmittalTransitionParams = {
  token: string;
  projectId: string;
  itemId: string;
  payload: Record<string, unknown>;
};

const SUBMITTALS_BASE_URL =
  "https://developer.api.autodesk.com/construction/submittals/v2";

export async function listSubmittalItems(params: SubmittalListParams) {
  const { token, projectId, limit, offset } = params;
  const url = new URL(`${SUBMITTALS_BASE_URL}/projects/${projectId}/items`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  return fetchApsJson(url.toString(), {
    token,
    serviceName: "submittals.listSubmittalItems"
  });
}

export async function getSubmittalItemTypes(params: SubmittalContextParams) {
  const { token, projectId } = params;
  return fetchApsJson(`${SUBMITTALS_BASE_URL}/projects/${projectId}/item-types`, {
    token,
    serviceName: "submittals.getSubmittalItemTypes"
  });
}

export async function getSubmittalResponses(params: SubmittalContextParams) {
  const { token, projectId } = params;
  return fetchApsJson(`${SUBMITTALS_BASE_URL}/projects/${projectId}/responses`, {
    token,
    serviceName: "submittals.getSubmittalResponses"
  });
}

export async function getSubmittalSpecs(params: SubmittalContextParams) {
  const { token, projectId } = params;
  return fetchApsJson(`${SUBMITTALS_BASE_URL}/projects/${projectId}/specs`, {
    token,
    serviceName: "submittals.getSubmittalSpecs"
  });
}

export async function transitionSubmittalItem(params: SubmittalTransitionParams) {
  const { token, projectId, itemId, payload } = params;
  return fetchApsJson(
    `${SUBMITTALS_BASE_URL}/projects/${projectId}/items/${itemId}:transition`,
    {
      method: "POST",
      token,
      body: payload,
      serviceName: "submittals.transitionSubmittalItem"
    }
  );
}
