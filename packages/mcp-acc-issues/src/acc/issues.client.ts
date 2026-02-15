import { URL } from "node:url";
import { fetchApsJson } from "@tad/shared";

export async function listIssues(params: {
  token: string;
  projectId: string;
  limit: number;
  offset: number;
}) {
  const { token, projectId, limit, offset } = params;

  const url = new URL(
    `https://developer.api.autodesk.com/construction/issues/v1/projects/${projectId}/issues`
  );
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  return fetchApsJson(url.toString(), {
    token,
    serviceName: "issues.listIssues"
  });
}

export async function createIssue(params: {
  token: string;
  projectId: string;
  payload: Record<string, unknown>;
  region?: string;
}) {
  const { token, projectId, payload, region } = params;
  return fetchApsJson(
    `https://developer.api.autodesk.com/construction/issues/v1/projects/${projectId}/issues`,
    {
      method: "POST",
      token,
      headers: region ? { "x-ads-region": region } : undefined,
      body: payload,
      serviceName: "issues.createIssue"
    }
  );
}
