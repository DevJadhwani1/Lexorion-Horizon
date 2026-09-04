package com.lexorion.platform.domain.service;

import com.lexorion.platform.domain.config.DomainProperties;
import com.lexorion.platform.domain.context.OrganizationContext;
import com.lexorion.platform.domain.context.OrganizationContextMode;
import com.lexorion.platform.domain.entity.DomainAccessMode;
import com.lexorion.platform.domain.entity.DomainType;
import com.lexorion.platform.domain.entity.DomainVerificationStatus;
import com.lexorion.platform.domain.entity.OrganizationDomain;
import com.lexorion.platform.domain.exception.TenantHostnameUnavailableException;
import com.lexorion.platform.domain.repository.OrganizationDomainRepository;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrganizationContextResolver {
   private final OrganizationDomainRepository organizationDomainRepository;
   private final String sharedPlatformHostname;

   public OrganizationContextResolver(OrganizationDomainRepository organizationDomainRepository, DomainProperties properties, HostnameNormalizer hostnameNormalizer) {
      this.organizationDomainRepository = organizationDomainRepository;
      this.sharedPlatformHostname = hostnameNormalizer.normalize(properties.getSharedPlatformHostname());
   }

   @Transactional(
      readOnly = true
   )
   public Optional<OrganizationContext> resolve(String normalizedHostname) {
      if (this.sharedPlatformHostname.equals(normalizedHostname)) {
         return Optional.empty();
      } else {
         Optional<OrganizationDomain> match = this.organizationDomainRepository.findByHostnameWithOrganization(normalizedHostname);
         if (match.isEmpty()) {
            return Optional.empty();
         } else {
            OrganizationDomain domain = (OrganizationDomain)match.get();
            if (domain.isActive() && domain.getVerificationStatus() == DomainVerificationStatus.VERIFIED && domain.getDomainType() != DomainType.PLATFORM_SUBDOMAIN && domain.getAccessMode() == DomainAccessMode.WHITE_LABEL && domain.getOrganization().getStatus().allowsTenantAccess()) {
               return Optional.of(new OrganizationContext(domain.getOrganization().getId(), domain.getOrganization().getSlug(), domain.getOrganization().getStatus(), domain.getHostname(), OrganizationContextMode.WHITE_LABEL_DOMAIN, domain.getDomainType(), domain.getAccessMode()));
            } else {
               throw new TenantHostnameUnavailableException();
            }
         }
      }
   }
}
