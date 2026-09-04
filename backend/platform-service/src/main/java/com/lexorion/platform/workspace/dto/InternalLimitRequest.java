package com.lexorion.platform.workspace.dto;
import jakarta.validation.constraints.Null;
import jakarta.validation.constraints.PositiveOrZero;
import java.util.UUID;
public record InternalLimitRequest(@PositiveOrZero int requestedValue,
        @Null UUID organizationId, @Null UUID workspaceId, @Null UUID userId, @Null String role) { }
