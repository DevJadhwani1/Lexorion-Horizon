package com.lexorion.horizon.workspace.dto;

import com.lexorion.horizon.workspace.entity.WorkspaceStatus;
import jakarta.validation.constraints.Null;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record UpdateWorkspaceRequest(
        @Size(max = 150) String displayName,
        WorkspaceStatus status,
        @Null(message = "organizationId is not accepted") UUID organizationId,
        @Null(message = "productId is not accepted") UUID productId,
        @Null(message = "productKey cannot be changed") String productKey,
        @Size(min = 1, max = 20) java.util.Set<@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Pattern(regexp = "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$") String> productKeys) { }
