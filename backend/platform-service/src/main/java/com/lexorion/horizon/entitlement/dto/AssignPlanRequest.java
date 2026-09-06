package com.lexorion.horizon.entitlement.dto;
import jakarta.validation.constraints.*;
import java.util.UUID;
public record AssignPlanRequest(
        @NotBlank @Pattern(regexp = "^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$") String planKey,
        @Null(message = "organizationId is not accepted") UUID organizationId,
        @Null(message = "productId is not accepted") UUID productId,
        @Null(message = "planId is not accepted; use planKey") UUID planId,
        @Null(message = "workspaceId is not accepted") UUID workspaceId,
        @Null(message = "entitlementId is not accepted") UUID entitlementId) { }
