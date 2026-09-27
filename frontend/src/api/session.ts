const ACCESS = "lexorion.accessToken", REFRESH = "lexorion.refreshToken", MODE = "lexorion.applicationMode", ORG = "lexorion.organization", WORKSPACE = "lexorion.workspace";
export const usesSharedSessionCookie = (hostname = window.location.hostname) => ["horizon.lexorion.in", "admin.horizon.lexorion.in"].includes(hostname.toLowerCase());
export const session = {
  access: () => sessionStorage.getItem(ACCESS), refresh: () => sessionStorage.getItem(REFRESH),
  setTokens: (access: string, refresh: string) => { sessionStorage.setItem(ACCESS, access); if (refresh) sessionStorage.setItem(REFRESH, refresh); else sessionStorage.removeItem(REFRESH); },
  clearTokens: () => { sessionStorage.removeItem(ACCESS); sessionStorage.removeItem(REFRESH); },
  mode: () => sessionStorage.getItem(MODE), setMode: (value: "platform" | "client" | null) => value ? sessionStorage.setItem(MODE, value) : sessionStorage.removeItem(MODE),
  organization: () => sessionStorage.getItem(ORG), setOrganization: (value: string | null) => value ? sessionStorage.setItem(ORG, value) : sessionStorage.removeItem(ORG),
  workspace: () => sessionStorage.getItem(WORKSPACE), setWorkspace: (value: string | null) => value ? sessionStorage.setItem(WORKSPACE, value) : sessionStorage.removeItem(WORKSPACE)
};
