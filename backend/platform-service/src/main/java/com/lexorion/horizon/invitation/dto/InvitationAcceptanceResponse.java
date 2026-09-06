package com.lexorion.horizon.invitation.dto;

import com.lexorion.horizon.membership.entity.OrganizationRole;

public record InvitationAcceptanceResponse(String organizationSlug, String organizationName, OrganizationRole role) {
}
