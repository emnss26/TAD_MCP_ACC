import { URL } from "node:url";
import { fetchApsJson } from "@tad/shared";

type AssetListParams = {
  token: string;
  projectId: string;
  limit: number;
  offset: number;
};

type AssetContextParams = {
  token: string;
  projectId: string;
};

const ASSETS_V2_BASE_URL = "https://developer.api.autodesk.com/construction/assets/v2";
const ASSETS_V1_BASE_URL = "https://developer.api.autodesk.com/construction/assets/v1";

export async function listAssets(params: AssetListParams) {
  const { token, projectId, limit, offset } = params;
  const url = new URL(`${ASSETS_V2_BASE_URL}/projects/${projectId}/assets`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  return fetchApsJson(url.toString(), {
    token,
    serviceName: "assets.listAssets"
  });
}

export async function getAssetCategories(params: AssetContextParams) {
  const { token, projectId } = params;
  return fetchApsJson(
    `${ASSETS_V1_BASE_URL}/projects/${projectId}/categories`,
    {
      token,
      serviceName: "assets.getAssetCategories"
    }
  );
}

export async function getAssetStatusStepSets(params: AssetContextParams) {
  const { token, projectId } = params;
  return fetchApsJson(
    `${ASSETS_V1_BASE_URL}/projects/${projectId}/status-step-sets`,
    {
      token,
      serviceName: "assets.getAssetStatusStepSets"
    }
  );
}

export async function getAssetStatuses(params: AssetContextParams) {
  const { token, projectId } = params;
  return fetchApsJson(
    `${ASSETS_V1_BASE_URL}/projects/${projectId}/asset-statuses`,
    {
      token,
      serviceName: "assets.getAssetStatuses"
    }
  );
}

export async function getAssetCustomAttributes(params: AssetContextParams) {
  const { token, projectId } = params;
  return fetchApsJson(
    `${ASSETS_V1_BASE_URL}/projects/${projectId}/custom-attributes`,
    {
      token,
      serviceName: "assets.getAssetCustomAttributes"
    }
  );
}
