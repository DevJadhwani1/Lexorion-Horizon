const ACCESS = "lexorion.accessToken", REFRESH = "lexorion.refreshToken", MODE = "lexorion.applicationMode", ORG = "lexorion.organization", WORKSPACE = "lexorion.workspace";
export const usesSharedSessionCookie = (hostname = window.location.hostname) => ["horizon.lexorion.in", "admin.horizon.lexorion.in"].includes(hostname.toLowerCase());
let contextVersion = 0;
const setContext = (key: string, value: string | null) => {
  if (sessionStorage.getItem(key) !== value) contextVersion++;
  if (value) sessionStorage.setItem(key, value); else sessionStorage.removeItem(key);
};
export const session = {
  contextVersion: () => contextVersion,
  access: () => sessionStorage.getItem(ACCESS), refresh: () => sessionStorage.getItem(REFRESH),
  setTokens: (access: string, refresh: string) => { sessionStorage.setItem(ACCESS, access); if (refresh) sessionStorage.setItem(REFRESH, refresh); else sessionStorage.removeItem(REFRESH); },
  clearTokens: () => { contextVersion++; sessionStorage.removeItem(ACCESS); sessionStorage.removeItem(REFRESH); },
  mode: () => sessionStorage.getItem(MODE), setMode: (value: "platform" | "client" | null) => value ? sessionStorage.setItem(MODE, value) : sessionStorage.removeItem(MODE),
  organization: () => sessionStorage.getItem(ORG), setOrganization: (value: string | null) => setContext(ORG, value),
  workspace: () => sessionStorage.getItem(WORKSPACE), setWorkspace: (value: string | null) => setContext(WORKSPACE, value)
};
