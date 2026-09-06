package com.lexorion.horizon.membership.dto;

import com.lexorion.horizon.membership.entity.OrganizationRole;
import jakarta.validation.constraints.NotNull;

public record UpdateMembershipRoleRequest(@NotNull OrganizationRole role) {
}
