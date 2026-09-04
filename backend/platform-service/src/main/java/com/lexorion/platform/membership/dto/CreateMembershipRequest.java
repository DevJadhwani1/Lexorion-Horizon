package com.lexorion.platform.membership.dto;

import com.lexorion.platform.membership.entity.OrganizationRole;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreateMembershipRequest(@NotNull UUID userId, @NotNull OrganizationRole role) {
}
