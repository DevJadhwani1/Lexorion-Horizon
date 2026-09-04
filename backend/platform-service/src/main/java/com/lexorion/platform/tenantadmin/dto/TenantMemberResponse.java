package com.lexorion.platform.tenantadmin.dto;

import com.lexorion.platform.membership.entity.MembershipStatus;
import com.lexorion.platform.membership.entity.OrganizationMembership;
import com.lexorion.platform.membership.entity.OrganizationRole;
import com.lexorion.platform.user.entity.User;
import java.time.Instant;
import java.util.UUID;

public record TenantMemberResponse(UUID membershipId, String email, String fullName, OrganizationRole role, MembershipStatus status, Instant joinedAt) {
   public static TenantMemberResponse from(OrganizationMembership membership) {
      User user = membership.getUser();
      UUID var10002 = membership.getId();
      String var10003 = user.getEmail();
      String var10004 = user.getFirstName();
      return new TenantMemberResponse(var10002, var10003, (var10004 + " " + user.getLastName()).trim(), membership.getRole(), membership.getStatus(), membership.getJoinedAt());
   }
}
