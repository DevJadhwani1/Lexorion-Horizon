package com.lexorion.platform.domain.service;

import com.lexorion.platform.domain.dto.OrganizationDomainResponse;
import com.lexorion.platform.domain.entity.DomainAccessMode;
import com.lexorion.platform.domain.entity.DomainType;
import com.lexorion.platform.domain.entity.DomainVerificationStatus;
import com.lexorion.platform.domain.entity.OrganizationDomain;
import com.lexorion.platform.domain.exception.InvalidDomainStateException;
import com.lexorion.platform.domain.repository.OrganizationDomainRepository;
import com.lexorion.core.exception.DuplicateResourceException;
import com.lexorion.core.exception.ResourceNotFoundException;
import com.lexorion.core.organization.entity.Organization;
import com.lexorion.core.organization.repository.OrganizationRepository;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class OrganizationDomainService {
   private final OrganizationDomainRepository domainRepository;
   private final OrganizationRepository organizationRepository;
   private final HostnameNormalizer hostnameNormalizer;
   private final Clock clock;

   public OrganizationDomainService(OrganizationDomainRepository domainRepository, OrganizationRepository organizationRepository, HostnameNormalizer hostnameNormalizer, Clock clock) {
      this.domainRepository = domainRepository;
      this.organizationRepository = organizationRepository;
      this.hostnameNormalizer = hostnameNormalizer;
      this.clock = clock;
   }

   public OrganizationDomainResponse addCustomDomain(UUID organizationId, String hostname, DomainType domainType, DomainAccessMode accessMode) {
      if (domainType != null && domainType != DomainType.PLATFORM_SUBDOMAIN) {
         if (accessMode == null) {
            throw new InvalidDomainStateException("Domain access mode is required");
         } else {
            String normalized = this.hostnameNormalizer.normalize(hostname);
            this.assertHostnameAvailable(normalized);
            Organization organization = this.lockOrganization(organizationId);
            OrganizationDomain domain = new OrganizationDomain();
            domain.setOrganization(organization);
            domain.setHostname(normalized);
            domain.setDomainType(domainType);
            domain.setAccessMode(accessMode);
            domain.setVerificationStatus(DomainVerificationStatus.PENDING);
            domain.setPrimaryDomain(!this.domainRepository.existsByOrganizationId(organizationId));
            domain.setActive(false);
            return OrganizationDomainResponse.from((OrganizationDomain)this.domainRepository.saveAndFlush(domain));
         }
      } else {
         throw new InvalidDomainStateException("Custom domain type must be CUSTOM_SUBDOMAIN or CUSTOM_DOMAIN");
      }
   }

   @Transactional(
      readOnly = true
   )
   public List<OrganizationDomainResponse> listDomains(UUID organizationId) {
      this.requireOrganization(organizationId);
      return this.domainRepository.findByOrganizationIdOrderByPrimaryDomainDescHostnameAsc(organizationId).stream().map(OrganizationDomainResponse::from).toList();
   }

   @Transactional(
      readOnly = true
   )
   public Optional<OrganizationDomain> findByHostname(String hostname) {
      return this.domainRepository.findByHostname(this.hostnameNormalizer.normalize(hostname));
   }

   public OrganizationDomainResponse setPrimaryDomain(UUID organizationId, String hostname) {
      this.lockOrganization(organizationId);
      OrganizationDomain domain = this.findOwnedDomainForUpdate(organizationId, hostname);
      this.domainRepository.clearPrimaryForOrganization(organizationId);
      domain.setPrimaryDomain(true);
      return OrganizationDomainResponse.from((OrganizationDomain)this.domainRepository.saveAndFlush(domain));
   }

   public OrganizationDomainResponse setActive(UUID organizationId, String hostname, boolean active) {
      OrganizationDomain domain = this.findOwnedDomainForUpdate(organizationId, hostname);
      if (active && domain.getVerificationStatus() != DomainVerificationStatus.VERIFIED) {
         throw new InvalidDomainStateException("Only verified domains can be activated");
      } else {
         domain.setActive(active);
         return OrganizationDomainResponse.from((OrganizationDomain)this.domainRepository.saveAndFlush(domain));
      }
   }

   public OrganizationDomainResponse markVerificationStatus(UUID organizationId, String hostname, DomainVerificationStatus status) {
      if (status == null) {
         throw new InvalidDomainStateException("Domain verification status is required");
      } else {
         OrganizationDomain domain = this.findOwnedDomainForUpdate(organizationId, hostname);
         if (domain.getDomainType() == DomainType.PLATFORM_SUBDOMAIN && status != DomainVerificationStatus.VERIFIED) {
            throw new InvalidDomainStateException("Platform-managed domains must remain verified");
         } else {
            domain.setVerificationStatus(status);
            domain.setVerifiedAt(status == DomainVerificationStatus.VERIFIED ? this.clock.instant() : null);
            if (status != DomainVerificationStatus.VERIFIED) {
               domain.setActive(false);
            }

            return OrganizationDomainResponse.from((OrganizationDomain)this.domainRepository.saveAndFlush(domain));
         }
      }
   }

   private OrganizationDomain findOwnedDomainForUpdate(UUID organizationId, String hostname) {
      String normalized = this.hostnameNormalizer.normalize(hostname);
      return (OrganizationDomain)this.domainRepository.findOwnedForUpdate(organizationId, normalized).orElseThrow(() -> new ResourceNotFoundException("Organization domain not found"));
   }

   private Organization lockOrganization(UUID organizationId) {
      return (Organization)this.organizationRepository.findByIdForUpdate(organizationId).orElseThrow(() -> ResourceNotFoundException.of("Organization", organizationId));
   }

   private void requireOrganization(UUID organizationId) {
      if (!this.organizationRepository.existsById(organizationId)) {
         throw ResourceNotFoundException.of("Organization", organizationId);
      }
   }

   private void assertHostnameAvailable(String hostname) {
      if (this.domainRepository.existsByHostname(hostname)) {
         throw new DuplicateResourceException("Hostname already in use: " + hostname);
      }
   }
}
