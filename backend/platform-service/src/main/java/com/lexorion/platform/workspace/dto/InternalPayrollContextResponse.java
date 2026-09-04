package com.lexorion.platform.workspace.dto;

import java.util.UUID;

/** Trusted Platform-to-Payroll authority context. Never expose this contract through the Gateway. */
public record InternalPayrollContextResponse(
        UUID workspaceId,
        String workspaceKey,
        UUID organizationId,
        String organizationSlug,
        String role,
        UUID userId) { }
