package com.lexorion.platform.security;

import com.lexorion.platform.membership.entity.OrganizationRole;
import com.lexorion.platform.membership.repository.OrganizationMembershipRepository;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component("authorization")
public class AuthorizationService {
   private final OrganizationMembershipRepository membershipRepository;

   public AuthorizationService(OrganizationMembershipRepository membershipRepository) {
      this.membershipRepository = membershipRepository;
   }

   public boolean isSelfOrPlatform(Authentication authentication, UUID userId) {
      AuthenticatedUser user = principal(authentication);
      return user != null && (user.platformAccess() || user.userId().equals(userId));
   }

   public boolean canReadOrganization(Authentication authentication, UUID organizationId) {
      AuthenticatedUser user = principal(authentication);
      return user != null && (user.platformAccess() || user.organizations().containsKey(organizationId));
   }

   public boolean canManageOrganization(Authentication authentication, UUID organizationId) {
      AuthenticatedUser user = principal(authentication);
      if (user == null) {
         return false;
      } else if (user.platformAccess()) {
         return true;
      } else {
         OrganizationAuthority organization = (OrganizationAuthority)user.organizations().get(organizationId);
         if (organization != null && organization.status().allowsTenantManagement()) {
            OrganizationRole role = organization.role();
            return role == OrganizationRole.OWNER || role == OrganizationRole.ADMIN;
         } else {
            return false;
         }
      }
   }

   @Transactional(
      readOnly = true
   )
   public boolean canManageMembership(Authentication authentication, UUID membershipId) {
      return (Boolean)this.membershipRepository.findById(membershipId).map((membership) -> this.canManageOrganization(authentication, membership.getOrganization().getId())).orElse(false);
   }

   private static AuthenticatedUser principal(Authentication authentication) {
      AuthenticatedUser var10000;
      if (authentication != null) {
         Object var2 = authentication.getPrincipal();
         if (var2 instanceof AuthenticatedUser) {
            AuthenticatedUser user = (AuthenticatedUser)var2;
            var10000 = user;
            return var10000;
         }
      }

      var10000 = null;
      return var10000;
   }
}
