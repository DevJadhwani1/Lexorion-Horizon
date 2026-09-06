package com.lexorion.platform.domain.service;

import com.lexorion.platform.domain.context.OrganizationContext;
import com.lexorion.platform.domain.context.OrganizationContextMode;
import com.lexorion.platform.domain.entity.DomainAccessMode;
import com.lexorion.platform.domain.entity.DomainType;
import com.lexorion.platform.domain.exception.InvalidOrganizationSelectionException;
import com.lexorion.platform.domain.exception.OrganizationSelectionDeniedException;
import com.lexorion.horizon.membership.entity.MembershipStatus;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import com.lexorion.core.organization.entity.Organization;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.platform.organization.service.TenantSlugService;
import com.lexorion.platform.security.AuthenticatedUser;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SharedPlatformOrganizationResolver {
   private final TenantSlugService tenantSlugService;
   private final OrganizationRepository organizationRepository;
   private final OrganizationMembershipRepository membershipRepository;

   public SharedPlatformOrganizationResolver(TenantSlugService tenantSlugService, OrganizationRepository organizationRepository, OrganizationMembershipRepository membershipRepository) {
      this.tenantSlugService = tenantSlugService;
      this.organizationRepository = organizationRepository;
      this.membershipRepository = membershipRepository;
   }

   @Transactional(
      readOnly = true
   )
   public Optional<OrganizationContext> resolveCurrent(String requestedSlug, String sharedHostname) {
      Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
      if (authentication != null && authentication.isAuthenticated()) {
         Object var5 = authentication.getPrincipal();
         if (var5 instanceof AuthenticatedUser) {
            AuthenticatedUser user = (AuthenticatedUser)var5;
            String var7 = this.normalizeSelection(requestedSlug);
            Organization organization = (Organization)this.organizationRepository.findBySlug(var7).filter((candidate) -> candidate.getStatus().allowsTenantAccess()).orElseThrow(OrganizationSelectionDeniedException::new);
            if (this.membershipRepository.findByUserIdAndOrganizationIdAndStatus(user.userId(), organization.getId(), MembershipStatus.ACTIVE).isEmpty()) {
               throw new OrganizationSelectionDeniedException();
            }

            return Optional.of(new OrganizationContext(organization.getId(), organization.getSlug(), organization.getStatus(), sharedHostname, OrganizationContextMode.SHARED_PLATFORM, (DomainType)null, (DomainAccessMode)null));
         }
      }

      return Optional.empty();
   }

   public String normalizeSelection(String requestedSlug) {
      if (requestedSlug != null && !requestedSlug.isBlank()) {
         try {
            UUID.fromString(requestedSlug.trim());
            throw new InvalidOrganizationSelectionException("Organization selection must use a slug");
         } catch (IllegalArgumentException var3) {
            return this.tenantSlugService.normalizeExplicit(requestedSlug);
         }
      } else {
         throw new InvalidOrganizationSelectionException("Organization slug is required");
      }
   }
}
