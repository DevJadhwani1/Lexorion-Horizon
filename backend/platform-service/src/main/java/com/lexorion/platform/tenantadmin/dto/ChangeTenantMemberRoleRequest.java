package com.lexorion.platform.tenantadmin.dto;

import com.lexorion.platform.membership.entity.OrganizationRole;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Null;
import java.util.UUID;

public record ChangeTenantMemberRoleRequest(@NotNull OrganizationRole role, @Null(
   message = "organizationId is not accepted; tenant context determines the organization"
) UUID organizationId) {
}
