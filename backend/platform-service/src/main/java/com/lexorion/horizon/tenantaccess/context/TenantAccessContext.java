package com.lexorion.horizon.tenantaccess.context;

import com.lexorion.horizon.membership.entity.MembershipStatus;
import com.lexorion.horizon.membership.entity.OrganizationRole;
import java.util.UUID;

public record TenantAccessContext(UUID userId, UUID organizationId, String organizationSlug, OrganizationRole membershipRole, MembershipStatus membershipStatus, boolean platformAuthority) {
}
