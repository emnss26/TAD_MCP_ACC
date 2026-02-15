import { URL } from "node:url";
import { fetchApsJson } from "@tad/shared";

type TransmittalListParams = {
  token: string;
  projectId: string;
  limit: number;
  offset: number;
};

const TRANSMITTALS_BASE_URL = "https://developer.api.autodesk.com/construction/transmittals/v1";

export async function listTransmittals(params: TransmittalListParams) {
  const { token, projectId, limit, offset } = params;
  const url = new URL(
    `${TRANSMITTALS_BASE_URL}/projects/${projectId}/transmittals`
  );
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  return fetchApsJson(url.toString(), {
    token,
    serviceName: "transmittals.listTransmittals"
  });
}
