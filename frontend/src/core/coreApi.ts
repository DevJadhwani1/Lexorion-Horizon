import { apiRequest } from "../api/httpClient";

export interface ProductAccess {
  productKey: string;
  displayName: string;
  validUntil: string | null;
}

export const getProductAccess = (organizationId: string) =>
  apiRequest<ProductAccess[]>(`/api/core/me/organizations/${encodeURIComponent(organizationId)}/products`, {
    organizationScoped: false,
    workspaceScoped: false,
  });
