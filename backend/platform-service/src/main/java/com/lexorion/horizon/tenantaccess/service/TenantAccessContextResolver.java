package com.lexorion.horizon.tenantaccess.service;

import com.lexorion.platform.domain.context.OrganizationContext;
import com.lexorion.platform.domain.context.OrganizationContextHolder;
import com.lexorion.horizon.membership.entity.MembershipStatus;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import com.lexorion.platform.security.AuthenticatedUser;
import com.lexorion.horizon.tenantaccess.context.TenantAccessContext;
import java.util.Optional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TenantAccessContextResolver {
   private final OrganizationContextHolder organizationContextHolder;
   private final OrganizationMembershipRepository membershipRepository;

   public TenantAccessContextResolver(OrganizationContextHolder organizationContextHolder, OrganizationMembershipRepository membershipRepository) {
      this.organizationContextHolder = organizationContextHolder;
      this.membershipRepository = membershipRepository;
   }

   @Transactional(
      readOnly = true
   )
   public Optional<TenantAccessContext> resolveCurrent() {
      Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
      if (authentication != null && authentication.isAuthenticated()) {
         Object var3 = authentication.getPrincipal();
         if (var3 instanceof AuthenticatedUser) {
            AuthenticatedUser user = (AuthenticatedUser)var3;
            Optional<OrganizationContext> organizationContext = this.organizationContextHolder.get();
            if (organizationContext.isEmpty()) {
               return Optional.empty();
            }

            OrganizationContext organization = (OrganizationContext)organizationContext.get();
            return this.membershipRepository.findByUserIdAndOrganizationIdAndStatus(user.userId(), organization.organizationId(), MembershipStatus.ACTIVE).map((membership) -> new TenantAccessContext(user.userId(), organization.organizationId(), organization.organizationSlug(), membership.getRole(), membership.getStatus(), user.platformAccess()));
         }
      }

      return Optional.empty();
   }
}
