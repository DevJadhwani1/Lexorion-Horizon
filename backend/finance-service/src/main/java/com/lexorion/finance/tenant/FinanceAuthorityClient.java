package com.lexorion.finance.tenant;

public interface FinanceAuthorityClient {
    TrustedFinanceContext validate(String workspaceKey, String bearerToken, String host, String organizationSlug);
}
