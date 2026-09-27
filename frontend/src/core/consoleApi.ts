import { apiRequest, type RequestOptions } from "../api/httpClient";
export const coreRequest = <T,>(path: string, options: RequestOptions = {}) => apiRequest<T>(`/api/core${path}`, {
  ...options, organizationScoped: false, workspaceScoped: false,
});
export interface CoreIdentity { userId: string; email: string; organizationIds: string[]; coreOperator: boolean }
export interface CoreOrganization { id: string; name: string; organizationCode: string; slug: string; primaryEmail: string; status: string }
export interface CoreUser { id: string; email: string; firstName: string; lastName: string; status: string }
export interface CoreProduct { id: string; key: string; displayName: string; active: boolean }
export interface CoreGrant { id: string; organizationId: string; productKey: string; status: string; validFrom: string | null; validUntil: string | null }
export interface CoreOperator { userId: string; userEmail: string; role: string; status: string }
export interface CoreSession { sessionId: string; userId: string; email: string; createdAt: string; expiresAt: string; active: boolean }
export interface CoreAudit { id: string; occurredAt: string; actorUserId: string | null; operation: string; resourceType: string; resourceId: string | null; result: string; correlationId: string | null }
export interface CoreMembership { id: string; userId: string; status: string }
