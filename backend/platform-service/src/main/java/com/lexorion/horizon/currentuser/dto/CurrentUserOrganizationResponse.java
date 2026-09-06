package com.lexorion.horizon.currentuser.dto;

import com.lexorion.horizon.membership.entity.MembershipStatus;
import com.lexorion.horizon.membership.entity.OrganizationRole;
import com.lexorion.core.organization.entity.OrganizationStatus;
import java.util.UUID;

public record CurrentUserOrganizationResponse(UUID organizationId, String organizationName, String slug, OrganizationRole membershipRole, MembershipStatus membershipStatus, OrganizationStatus organizationStatus) {
}
