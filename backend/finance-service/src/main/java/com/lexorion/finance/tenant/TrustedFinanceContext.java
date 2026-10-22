package com.lexorion.finance.tenant;

import java.util.UUID;

/** Workspace authority returned by Platform for the delegated user. Every field is required. */
public record TrustedFinanceContext(UUID workspaceId, String workspaceKey, UUID organizationId,
        String organizationSlug, String role, UUID userId) {
    private static final UUID ZERO = new UUID(0, 0);

    public TrustedFinanceContext {
        if (workspaceId == null || workspaceId.equals(ZERO) || organizationId == null || organizationId.equals(ZERO)
                || userId == null || userId.equals(ZERO) || workspaceKey == null || workspaceKey.isBlank()
                || organizationSlug == null || organizationSlug.isBlank() || role == null)
            throw new IllegalArgumentException("Complete trusted Platform authority context is required");
        FinanceRole.valueOf(role);
    }
}
