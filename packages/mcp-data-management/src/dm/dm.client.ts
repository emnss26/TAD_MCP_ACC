import {
  fetchApsJson,
  getHubProjects as getHubProjectsShared,
  getProjectTopFolders as getProjectTopFoldersShared,
  getFolderDetails as getFolderDetailsShared,
  getFolderContents as getFolderContentsShared,
  getItemDetails as getItemDetailsShared,
  getVersionDetails as getVersionDetailsShared
} from "@tad/shared";

const BASE_URL = "https://developer.api.autodesk.com/project/v1";
const DATA_URL = "https://developer.api.autodesk.com/data/v1";

export const getHubProjects = (hubId: string) => getHubProjectsShared(hubId);

export const getProjectDetails = (hubId: string, projectId: string) =>
  fetchApsJson(`${BASE_URL}/hubs/${hubId}/projects/${projectId}`, {
    serviceName: "dm.getProjectDetails"
  });

export const getFolderContents = (projectId: string, folderId: string) =>
  getFolderContentsShared({
    projectId,
    folderId
  });

export const getProjectTopFolders = (hubId: string, projectId: string) =>
  getProjectTopFoldersShared({
    hubId,
    projectId
  });

export const getFolderDetails = (projectId: string, folderId: string) =>
  getFolderDetailsShared({
    projectId,
    folderId
  });

export const getItemDetails = (projectId: string, itemId: string) =>
  getItemDetailsShared({
    projectId,
    itemId
  });

export const getVersionDetails = (projectId: string, versionId: string) =>
  getVersionDetailsShared({
    projectId,
    versionId
  });

export const getItemVersions = (projectId: string, itemId: string) =>
  fetchApsJson(`${DATA_URL}/projects/${projectId}/items/${itemId}/versions`, {
    serviceName: "dm.getItemVersions"
  });
