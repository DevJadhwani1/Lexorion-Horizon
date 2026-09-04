package com.lexorion.platform.workspace.dto;

import com.lexorion.platform.workspace.entity.WorkspaceStatus;
import jakarta.validation.constraints.Null;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record UpdateWorkspaceRequest(
        @Size(max = 150) String displayName,
        WorkspaceStatus status,
        @Null(message = "organizationId is not accepted") UUID organizationId,
        @Null(message = "productId is not accepted") UUID productId,
        @Null(message = "productKey cannot be changed") String productKey) { }
