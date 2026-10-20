import { apiRequest } from "../../api/httpClient";

export interface PlatformOrganization {
  id: string; name: string; legalName: string | null; organizationCode: string; slug: string;
  primaryEmail: string; primaryPhone: string | null; status: string;
  trialStartedAt: string | null; trialEndsAt: string | null; activatedAt: string | null;
  suspendedAt: string | null; cancelledAt: string | null; createdAt: string; updatedAt: string;
}
export interface PlatformUser { id: string; email: string; firstName: string; lastName: string; status: string; createdAt: string; updatedAt: string }
export interface PlatformAccessRecord { id: string; userId: string; userEmail: string; role: string; status: string; grantedAt: string; createdAt: string; updatedAt: string }
export interface PlatformProduct { key: string; displayName: string; description: string | null; status: string }
export interface PlanEntitlement { key: string; valueType: "BOOLEAN" | "INTEGER"; booleanValue: boolean | null; integerValue: number | null }
export interface PlatformPlan { key: string; displayName: string; description: string | null; productKey: string | null; status: string; entitlements: PlanEntitlement[] }
export interface PlatformEntitlement { key: string; displayName: string; description: string | null; valueType: "BOOLEAN" | "INTEGER"; status: string }

const platformOptions = { organizationScoped: false, workspaceScoped: false } as const;
export const getPlatformOrganizations = () => apiRequest<PlatformOrganization[]>("/api/platform/organizations", platformOptions);
export const createPlatformOrganization = (body: { name: string; organizationCode: string; primaryEmail: string; ownerUserId: string; slug?: string }) =>
  apiRequest<PlatformOrganization>("/api/platform/organizations", { ...platformOptions, method: "POST", body });
export const activatePlatformOrganization = (id: string) =>
  apiRequest<PlatformOrganization>(`/api/platform/organizations/${encodeURIComponent(id)}/status`, { ...platformOptions, method: "PATCH", body: { status: "ACTIVE" } });
export const assignPlatformOrganizationPlan = (id: string, planKey: string) =>
  apiRequest<PlatformOrganization>(`/api/platform/organizations/${encodeURIComponent(id)}`, { ...platformOptions, method: "PATCH", body: { planKey } });
export const getPlatformOrganization = (id: string) => apiRequest<PlatformOrganization>(`/api/platform/organizations/${encodeURIComponent(id)}`, platformOptions);
export const getPlatformUsers = () => apiRequest<PlatformUser[]>("/api/platform/users", platformOptions);
export const getPlatformAccess = () => apiRequest<PlatformAccessRecord[]>("/api/platform/platform-access", platformOptions);
export const updatePlatformAccessRole = (userId: string, role: string) => apiRequest<PlatformAccessRecord>(`/api/platform/platform-access/${encodeURIComponent(userId)}/role`, { ...platformOptions, method: "PATCH", body: { role } });
export const updatePlatformAccessStatus = (userId: string, status: string) => apiRequest<PlatformAccessRecord>(`/api/platform/platform-access/${encodeURIComponent(userId)}/status`, { ...platformOptions, method: "PATCH", body: { status } });
export const getPlatformProducts = () => apiRequest<PlatformProduct[]>("/api/platform/products", platformOptions);
export const getPlatformPlans = async (): Promise<PlatformPlan[]> => {
  const plans = await apiRequest<PlatformPlan[]>("/api/platform/plans", platformOptions);
  return plans.map((plan) => ({ ...plan, entitlements: Array.isArray(plan.entitlements) ? plan.entitlements : [] }));
};
export const getPlatformEntitlements = () => apiRequest<PlatformEntitlement[]>("/api/platform/entitlements", platformOptions);
