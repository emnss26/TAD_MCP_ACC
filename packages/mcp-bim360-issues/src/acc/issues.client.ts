import { URL } from "node:url";
import { fetchApsJson } from "@tad/shared";

export async function listIssues(params: {
  token: string;
  containerId: string;
  limit: number;
  offset: number;
}) {
  const { token, containerId, limit, offset } = params;

  const url = new URL(
    `https://developer.api.autodesk.com/issues/v2/containers/${containerId}/issues`
  );
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  return fetchApsJson(url.toString(), {
    token,
    serviceName: "issues.listIssues"
  });
}
