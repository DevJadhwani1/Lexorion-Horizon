package com.lexorion.platform.organization.service;

import com.lexorion.core.exception.DuplicateResourceException;
import com.lexorion.core.exception.ResourceNotFoundException;
import com.lexorion.horizon.membership.entity.MembershipStatus;
import com.lexorion.horizon.membership.entity.OrganizationMembership;
import com.lexorion.horizon.membership.entity.OrganizationRole;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import com.lexorion.platform.organization.dto.CreateOrganizationRequest;
import com.lexorion.platform.organization.dto.OrganizationResponse;
import com.lexorion.platform.organization.dto.UpdateOrganizationRequest;
import com.lexorion.platform.organization.dto.UpdateOrganizationStatusRequest;
import com.lexorion.core.organization.entity.Organization;
import com.lexorion.core.organization.entity.OrganizationStatus;
import com.lexorion.core.organization.exception.InvalidLifecycleTransitionException;
import com.lexorion.core.organization.exception.InvalidTenantSlugException;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.core.user.entity.User;
import com.lexorion.core.user.service.UserService;
import com.lexorion.core.organization.service.TenantSlugService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class OrganizationService {
   private final com.lexorion.core.organization.service.CoreOrganizationService coreOrganizations;
   private final OrganizationRepository organizationRepository;
   private final OrganizationMembershipRepository membershipRepository;
   private final UserService userService;
   private final TenantSlugService tenantSlugService;
   private final Clock clock;
   private final com.lexorion.horizon.workspace.service.HorizonProvisioningService horizon;

   public OrganizationService(OrganizationRepository organizationRepository, OrganizationMembershipRepository membershipRepository, UserService userService, TenantSlugService tenantSlugService, Clock clock, com.lexorion.horizon.workspace.service.HorizonProvisioningService horizon, com.lexorion.core.organization.service.CoreOrganizationService coreOrganizations) {
      this.coreOrganizations = coreOrganizations;
      this.horizon = horizon;
      this.organizationRepository = organizationRepository;
      this.membershipRepository = membershipRepository;
      this.userService = userService;
      this.tenantSlugService = tenantSlugService;
      this.clock = clock;
   }

   public OrganizationResponse create(CreateOrganizationRequest request) {
      var organization = coreOrganizations.create(new com.lexorion.core.organization.service.CoreOrganizationService.CreateOrganization(
            request.name(), request.organizationCode(), request.slug(), request.primaryEmail(), request.ownerUserId()));
      organization.setLegalName(request.legalName()); organization.setPrimaryPhone(request.primaryPhone());
      var ownership = membershipRepository.findByUserIdAndOrganizationIdAndStatus(request.ownerUserId(), organization.getId(), MembershipStatus.ACTIVE).orElseThrow();
      ownership.setRole(OrganizationRole.ADMIN); membershipRepository.saveAndFlush(ownership);
      horizon.enroll(organization.getId());
      return OrganizationResponse.from(organizationRepository.saveAndFlush(organization));
   }

   @Transactional(
      readOnly = true
   )
   public OrganizationResponse getById(UUID id) {
      return OrganizationResponse.from(this.findOrThrow(id));
   }

   @Transactional(
      readOnly = true
   )
   public List<OrganizationResponse> list() {
      return this.organizationRepository.findAll().stream().map(OrganizationResponse::from).toList();
   }

   public OrganizationResponse update(UUID id, UpdateOrganizationRequest request) {
      Organization organization = this.findOrThrow(id);
      if (request.name() != null) {
         organization.setName(request.name());
      }

      if (request.legalName() != null) {
         organization.setLegalName(request.legalName());
      }

      if (request.primaryEmail() != null) {
         organization.setPrimaryEmail(request.primaryEmail());
      }

      if (request.primaryPhone() != null) {
         organization.setPrimaryPhone(request.primaryPhone());
      }

      return OrganizationResponse.from((Organization)this.organizationRepository.saveAndFlush(organization));
   }

   public OrganizationResponse updateStatus(UUID id, UpdateOrganizationStatusRequest request) {
      Organization organization = this.findOrThrow(id);
      this.transition(organization, request.status(), this.clock.instant());
      return OrganizationResponse.from((Organization)this.organizationRepository.saveAndFlush(organization));
   }

   void transition(Organization organization, OrganizationStatus target, Instant now) {
      new com.lexorion.core.organization.service.OrganizationLifecycleService().transition(organization, target, now);
      // Preserve the existing Horizon onboarding trial policy outside Core.
      if (target == OrganizationStatus.TRIAL) organization.setTrialEndsAt(now.plus(Duration.ofDays(14)));
   }

   public void backfillMissingSlugs() {
      for(Organization organization : this.organizationRepository.findBySlugIsNullOrderByCreatedAtAsc()) {
         String base = this.backfillSlugBase(organization);
         String candidate = base;

         String ending;
         String var7;
         for(int suffix = 2; this.organizationRepository.existsBySlug(candidate); candidate = var7 + ending) {
            int var10000 = suffix++;
            ending = "-" + var10000;
            var7 = base.substring(0, Math.min(base.length(), 63 - ending.length()));
         }

         organization.setSlug(candidate);
         this.organizationRepository.save(organization);
      }

   }

   private String backfillSlugBase(Organization organization) {
      try {
         return this.tenantSlugService.generateFromName(organization.getOrganizationCode());
      } catch (InvalidTenantSlugException var5) {
         try {
            return this.tenantSlugService.generateFromName(organization.getName());
         } catch (InvalidTenantSlugException var4) {
            String var10000 = organization.getId().toString();
            return "tenant-" + var10000.substring(0, 12);
         }
      }
   }

   @Transactional(
      readOnly = true
   )
   public Organization getEntity(UUID id) {
      return this.findOrThrow(id);
   }

   private Organization findOrThrow(UUID id) {
      return (Organization)this.organizationRepository.findById(id).orElseThrow(() -> ResourceNotFoundException.of("Organization", id));
   }
}
