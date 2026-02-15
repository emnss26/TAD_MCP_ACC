import { fetchApsJson } from "@tad/shared";

const DOCS_URL = "https://developer.api.autodesk.com/bim360/docs/v1";

export async function getFolderPermissions(params: {
  token: string;
  projectIdWithoutB: string;
  folderId: string;
}) {
  return fetchApsJson(
    `${DOCS_URL}/projects/${encodeURIComponent(
      params.projectIdWithoutB
    )}/folders/${encodeURIComponent(params.folderId)}/permissions`,
    {
      token: params.token,
      serviceName: "files.getFolderPermissions"
    }
  );
}
