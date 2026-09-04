package com.lexorion.workforce.tenant;
public interface TenantAuthorityClient {
    /**
     * Returns Platform's authoritative authenticated user, internal organization,
     * internal workspace, public workspace key, tenant role, membership and product-access decision.
     * Implementations must fail instead of synthesizing any missing authority value.
     */
    TrustedWorkforceContext validate(String workspaceKey, String bearerToken, String host, String organizationSlug);
    TrustedWorkforceContext requireEmployeeLimit(String workspaceKey, int requestedValue, String bearerToken, String host, String organizationSlug);
    java.util.UUID resolveUser(String workspaceKey, String email, String bearerToken, String host, String organizationSlug);
}
