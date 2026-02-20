import { URL } from "node:url";
import { fetchApsJson } from "@tad/shared";

type RfiListParams = {
  token: string;
  containerId: string;
  limit: number;
  offset: number;
};

const RFIS_BASE_URL = "https://developer.api.autodesk.com/bim360/rfis/v2";

export async function listRfis(params: RfiListParams) {
  const { token, containerId, limit, offset } = params;
  const url = new URL(`${RFIS_BASE_URL}/containers/${containerId}/rfis`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  return fetchApsJson(url.toString(), {
    token,
    serviceName: "rfis.listRfis"
  });
}
