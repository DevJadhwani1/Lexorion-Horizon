package com.lexorion.platform.tenantaccess.context;

import com.lexorion.platform.membership.entity.MembershipStatus;
import com.lexorion.platform.membership.entity.OrganizationRole;
import java.util.UUID;

public record TenantAccessContext(UUID userId, UUID organizationId, String organizationSlug, OrganizationRole membershipRole, MembershipStatus membershipStatus, boolean platformAuthority) {
}
