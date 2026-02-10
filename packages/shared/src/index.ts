export type {
  ApsTokenResponse,
  AuthStatus,
  StartLoginResult,
  StoredAccSession
} from "./auth/types.js";

export {
  // exports “genéricos”
  beginLogin,
  completeLogin,
  getAuthStatus,
  logout,
  ensureAccessToken,
  saveSession,
  loadSession,

  // aliases “ACC-friendly” (los que usa mcp-acc-issues)
  beginLogin as startAccLogin,
  getAuthStatus as getAccAuthStatus,
  logout as logoutAcc,
  ensureAccessToken as getAccAccessToken
} from "./auth/authManager.js";

export { getContext, setContext } from "./config/contextStore.js";