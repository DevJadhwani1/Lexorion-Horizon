package com.lexorion.platform.membership.dto;

import com.lexorion.platform.membership.entity.OrganizationRole;
import jakarta.validation.constraints.NotNull;

public record UpdateMembershipRoleRequest(@NotNull OrganizationRole role) {
}
