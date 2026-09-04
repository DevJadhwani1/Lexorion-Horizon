package com.lexorion.platform.currentuser.dto;

import com.lexorion.platform.membership.entity.MembershipStatus;
import com.lexorion.platform.membership.entity.OrganizationRole;
import com.lexorion.platform.organization.entity.OrganizationStatus;
import java.util.UUID;

public record CurrentUserOrganizationResponse(UUID organizationId, String organizationName, String slug, OrganizationRole membershipRole, MembershipStatus membershipStatus, OrganizationStatus organizationStatus) {
}
