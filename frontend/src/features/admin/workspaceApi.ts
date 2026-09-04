import { apiRequest } from "../../api/httpClient";

export type RegistryStatus = "ACTIVE" | "INACTIVE";

export interface ProductCatalogItem {
  key: string;
  displayName: string;
  description: string;
  status: RegistryStatus;
}

export interface OrganizationWorkspace {
  key: string;
  displayName: string;
  status: RegistryStatus;
  productKey: string;
  productName: string;
}

export const getProductCatalog = () => apiRequest<ProductCatalogItem[]>("/api/platform/products");
export const getOrganizationWorkspaces = () => apiRequest<OrganizationWorkspace[]>("/api/tenant/workspaces");
export const getAccessibleWorkspaces = () => apiRequest<OrganizationWorkspace[]>("/api/tenant/workspaces/accessible");
export const createOrganizationWorkspace = (input: { key: string; displayName: string; productKey: string }) =>
  apiRequest<OrganizationWorkspace>("/api/tenant/workspaces", { method: "POST", body: input });
export const setOrganizationWorkspaceStatus = (key: string, status: RegistryStatus) =>
  apiRequest<OrganizationWorkspace>(`/api/tenant/workspaces/${encodeURIComponent(key)}`, { method: "PATCH", body: { status } });
