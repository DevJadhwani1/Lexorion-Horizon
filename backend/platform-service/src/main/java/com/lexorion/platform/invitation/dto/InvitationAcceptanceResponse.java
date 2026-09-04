package com.lexorion.platform.invitation.dto;

import com.lexorion.platform.membership.entity.OrganizationRole;

public record InvitationAcceptanceResponse(String organizationSlug, String organizationName, OrganizationRole role) {
}
