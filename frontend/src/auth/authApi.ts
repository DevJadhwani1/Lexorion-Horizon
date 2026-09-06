import { apiRequest } from "../api/httpClient";
export interface TokenResponse {
  tokenType: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
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
  apiRequest<TokenResponse>("/api/platform/auth/login", {
    method: "POST",
    body: { email, password },
    authenticated: false,
    organizationScoped: false,
    workspaceScoped: false,
    retryOnUnauthorized: false,
  });
export const logoutRequest = (refreshToken: string) =>
  apiRequest<void>("/api/platform/auth/logout", {
    method: "POST",
    body: { refreshToken },
    organizationScoped: false,
    workspaceScoped: false,
    retryOnUnauthorized: false,
  });
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
