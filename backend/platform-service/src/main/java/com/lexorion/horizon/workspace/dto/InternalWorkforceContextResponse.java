package com.lexorion.horizon.workspace.dto;
import java.util.UUID;
/**
 * Internal Platform-to-Workforce authority contract. Platform derives every value from authenticated
 * tenant context and the resolved Workforce workspace. UUIDs are persistence identities for the
 * trusted service boundary only and must never be routed through the public Gateway.
 */
public record InternalWorkforceContextResponse(UUID workspaceId, String workspaceKey, UUID organizationId, String organizationSlug, String role, UUID userId) { }
