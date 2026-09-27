import { apiRequest } from "../api/httpClient";
import { session, usesSharedSessionCookie } from "../api/session";
import { ApiError } from "../api/types";
export interface TokenResponse {
  tokenType: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string | null;
  refreshTokenExpiresAt: string;
}
export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  active: boolean;
  platformAccess: { active: boolean; role: string } | null;
}
export interface OrganizationMembership {
  organizationId: string;
  organizationName: string;
  slug: string;
  membershipRole: "ADMIN" | "MANAGER" | "EMPLOYEE";
  membershipStatus: string;
  organizationStatus: string;
}
export const loginRequest = (email: string, password: string) =>
  apiRequest<TokenResponse>("/api/core/auth/login", {
    method: "POST",
    body: { email, password },
    authenticated: false,
    organizationScoped: false,
    workspaceScoped: false,
    retryOnUnauthorized: false,
  });
export const logoutRequest = (refreshToken?: string | null) =>
  apiRequest<void>("/api/core/auth/logout", {
    method: "POST",
    body: refreshToken ? { refreshToken } : {},
    organizationScoped: false,
    workspaceScoped: false,
    retryOnUnauthorized: false,
  });
let restorePromise: Promise<boolean> | null = null;
export const restoreSession = (hostname = window.location.hostname) => {
  if (session.access()) return true;
  if (!usesSharedSessionCookie(hostname)) return false;
  restorePromise ??= (async () => {
    try {
      const tokens = await apiRequest<TokenResponse>("/api/core/auth/refresh", {
        method: "POST", body: {}, authenticated: false, organizationScoped: false, workspaceScoped: false, retryOnUnauthorized: false,
        credentials: usesSharedSessionCookie(hostname) ? "include" : "same-origin",
      });
      session.setTokens(tokens.accessToken, tokens.refreshToken ?? "");
      return true;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 0 && error.status < 500) return false;
      throw error;
    }
  })().finally(() => { restorePromise = null; });
  return restorePromise;
};
export const getCurrentUser = () =>
  apiRequest<CurrentUser>("/api/platform/me", {
    organizationScoped: false,
    workspaceScoped: false,
  });
export const getOrganizations = () =>
  apiRequest<OrganizationMembership[]>("/api/platform/me/organizations", {
    organizationScoped: false,
    workspaceScoped: false,
  });
