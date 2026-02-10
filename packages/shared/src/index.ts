export {
  // Nombres “ACC explícitos” (los que usan tus tools)
  startAccLogin,
  completeAccLogin,
  getAccAuthStatus,
  logoutAcc,
  getAccAccessToken,

  // Aliases “genéricos” por compatibilidad (si algún paquete viejo los usa)
  beginLogin,
  completeLogin,
  getAuthStatus,
  logout,
  ensureAccessToken,
} from "./auth/authManager.js";

export type { AccAuthStatus } from "./auth/types.js";

export { getContext, setContext, clearContext } from "./config/contextStore.js";