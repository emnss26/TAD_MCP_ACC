// Tipos
export type { AccAuthStatus } from "./aps/accAuth.js";
export type { StoredTokens } from "./aps/tokenStore.js";
export type {
  ProjectResolutionSource,
  ResolveProjectInput,
  ResolveProjectResult
} from "./aps/projectResolver.js";
export type {
  PaginatedResponse,
  FetchAllPagesOptions
} from "./aps/fetchAllPages.js";
export type { McpWarning, McpResponse } from "./schemas/mcpResponse.js";


// Lógica de Autenticación APS/ACC
export {
  startAccLogin,
  getAccAuthStatus,
  logoutAcc as accLogout,
  getAccAccessToken
} from "./aps/accAuth.js";

// Utilidades de almacenamiento
export { readTokens, writeTokens, clearTokens } from "./aps/tokenStore.js";

// Configuración global
export { getContext, setContext } from "./config/contextStore.js";

export {
  getProjectUsers,
  getProjectCompanies,
  getHubProjects
} from "./aps/accAdmin.js";
export {
  normalizeProjectIdWithB,
  normalizeProjectIdWithoutB,
  getProjectTopFolders,
  getFolderDetails,
  getFolderContents,
  getItemDetails,
  getVersionDetails
} from "./aps/dataManagement.js";

export {
  resolveProject,
  normalizeProjectIdForConstruction
} from "./aps/projectResolver.js";
export { fetchAllPages } from "./aps/fetchAllPages.js";
export { fetchApsJson, type FetchApsJsonOptions } from "./aps/http.js";
export {
  McpWarningSchema,
  McpPaginationSchema,
  McpMetaSchema,
  createMcpResponseSchema,
  buildMcpResponse,
  stringifyMcpPayload,
  ListViewSchema,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  clampListLimit,
  parseOffsetCursor,
  encodeOffsetCursor,
  getResultHandlePage,
  getResultHandleItem,
  exportResultHandle
} from "./schemas/mcpResponse.js";
export {
  registerAccAuthStartTool,
  registerAccAuthStatusTool,
  registerAccAuthLogoutTool,
  registerResultHandleTools,
  registerAccAuthTools,
  type McpToolServerLike
} from "./mcp/authTools.js";

export { queryAecDataModel } from "./aps/aecDataModel.js";
