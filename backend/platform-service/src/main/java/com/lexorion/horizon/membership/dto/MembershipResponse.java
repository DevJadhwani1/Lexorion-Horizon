package com.lexorion.horizon.membership.dto;

import com.lexorion.horizon.membership.entity.MembershipStatus;
import com.lexorion.horizon.membership.entity.OrganizationMembership;
import com.lexorion.horizon.membership.entity.OrganizationRole;
import com.lexorion.core.user.entity.User;
import java.time.Instant;
import java.util.UUID;

public record MembershipResponse(UUID id, UUID organizationId, UUID userId, String userEmail, String userFullName, OrganizationRole role, MembershipStatus status, Instant joinedAt, Instant createdAt, Instant updatedAt) {
   public static MembershipResponse from(OrganizationMembership membership) {
      User user = membership.getUser();
      return new MembershipResponse(membership.getId(), membership.getOrganization().getId(), user.getId(), user.getEmail(), user.getFirstName() + " " + user.getLastName(), membership.getRole(), membership.getStatus(), membership.getJoinedAt(), membership.getCreatedAt(), membership.getUpdatedAt());
   }
}
