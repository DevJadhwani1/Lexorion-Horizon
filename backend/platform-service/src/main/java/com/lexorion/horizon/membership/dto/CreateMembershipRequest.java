package com.lexorion.horizon.membership.dto;

import com.lexorion.horizon.membership.entity.OrganizationRole;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreateMembershipRequest(@NotNull UUID userId, @NotNull OrganizationRole role) {
}
