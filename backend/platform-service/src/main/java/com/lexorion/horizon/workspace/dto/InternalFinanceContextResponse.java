package com.lexorion.horizon.workspace.dto;

import java.util.UUID;

/** Trusted Platform-to-Finance authority context. Never expose this contract through the Gateway. */
public record InternalFinanceContextResponse(
        UUID workspaceId,
        String workspaceKey,
        UUID organizationId,
        String organizationSlug,
        String role,
        UUID userId) { }
