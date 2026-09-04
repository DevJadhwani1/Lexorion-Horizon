const ACCESS = "lexorion.accessToken", REFRESH = "lexorion.refreshToken", ORG = "lexorion.organization", WORKSPACE = "lexorion.workspace";
export const session = {
  access: () => sessionStorage.getItem(ACCESS), refresh: () => sessionStorage.getItem(REFRESH),
  setTokens: (access: string, refresh: string) => { sessionStorage.setItem(ACCESS, access); sessionStorage.setItem(REFRESH, refresh); },
  clearTokens: () => { sessionStorage.removeItem(ACCESS); sessionStorage.removeItem(REFRESH); },
  organization: () => sessionStorage.getItem(ORG), setOrganization: (value: string | null) => value ? sessionStorage.setItem(ORG, value) : sessionStorage.removeItem(ORG),
  workspace: () => sessionStorage.getItem(WORKSPACE), setWorkspace: (value: string | null) => value ? sessionStorage.setItem(WORKSPACE, value) : sessionStorage.removeItem(WORKSPACE)
};
