package com.lexorion.platform.organization.service;

import com.lexorion.platform.exception.DuplicateResourceException;
import com.lexorion.platform.exception.ResourceNotFoundException;
import com.lexorion.platform.membership.entity.MembershipStatus;
import com.lexorion.platform.membership.entity.OrganizationMembership;
import com.lexorion.platform.membership.entity.OrganizationRole;
import com.lexorion.platform.membership.repository.OrganizationMembershipRepository;
import com.lexorion.platform.organization.dto.CreateOrganizationRequest;
import com.lexorion.platform.organization.dto.OrganizationResponse;
import com.lexorion.platform.organization.dto.UpdateOrganizationRequest;
import com.lexorion.platform.organization.dto.UpdateOrganizationStatusRequest;
import com.lexorion.platform.organization.entity.Organization;
import com.lexorion.platform.organization.entity.OrganizationStatus;
import com.lexorion.platform.organization.exception.InvalidLifecycleTransitionException;
import com.lexorion.platform.organization.exception.InvalidTenantSlugException;
import com.lexorion.platform.organization.repository.OrganizationRepository;
import com.lexorion.platform.user.entity.User;
import com.lexorion.platform.user.service.UserService;
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
   private final OrganizationRepository organizationRepository;
   private final OrganizationMembershipRepository membershipRepository;
   private final UserService userService;
   private final TenantSlugService tenantSlugService;
   private final Clock clock;

   public OrganizationService(OrganizationRepository organizationRepository, OrganizationMembershipRepository membershipRepository, UserService userService, TenantSlugService tenantSlugService, Clock clock) {
      this.organizationRepository = organizationRepository;
      this.membershipRepository = membershipRepository;
      this.userService = userService;
      this.tenantSlugService = tenantSlugService;
      this.clock = clock;
   }

   public OrganizationResponse create(CreateOrganizationRequest request) {
      if (this.organizationRepository.existsByOrganizationCode(request.organizationCode())) {
         throw new DuplicateResourceException("Organization code already in use: " + request.organizationCode());
      } else {
         String slug = this.tenantSlugService.normalizeOrGenerate(request.slug(), request.name());
         if (this.organizationRepository.existsBySlug(slug)) {
            throw new DuplicateResourceException("Tenant slug already in use: " + slug);
         } else {
            User owner = this.userService.getEntity(request.ownerUserId());
            Organization organization = new Organization();
            organization.setName(request.name());
            organization.setLegalName(request.legalName());
            organization.setOrganizationCode(request.organizationCode());
            organization.setSlug(slug);
            organization.setPrimaryEmail(request.primaryEmail());
            organization.setPrimaryPhone(request.primaryPhone());
            organization.setStatus(OrganizationStatus.PENDING);
            organization = (Organization)this.organizationRepository.save(organization);
            OrganizationMembership ownership = new OrganizationMembership();
            ownership.setOrganization(organization);
            ownership.setUser(owner);
            ownership.setRole(OrganizationRole.OWNER);
            ownership.setStatus(MembershipStatus.ACTIVE);
            ownership.setJoinedAt(this.clock.instant());
            this.membershipRepository.save(ownership);
            return OrganizationResponse.from(organization);
         }
      }
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
      OrganizationStatus current = organization.getStatus();
      boolean var10000;
      switch (current) {
         case PENDING:
            var10000 = target == OrganizationStatus.TRIAL || target == OrganizationStatus.ACTIVE || target == OrganizationStatus.CANCELLED;
            break;
         case TRIAL:
            var10000 = target == OrganizationStatus.ACTIVE || target == OrganizationStatus.SUSPENDED || target == OrganizationStatus.CANCELLED;
            break;
         case ACTIVE:
            var10000 = target == OrganizationStatus.SUSPENDED || target == OrganizationStatus.CANCELLED;
            break;
         case SUSPENDED:
            var10000 = target == OrganizationStatus.ACTIVE || target == OrganizationStatus.CANCELLED;
            break;
         case CANCELLED:
         case TERMINATED:
            var10000 = false;
            break;
         default:
            throw new MatchException((String)null, (Throwable)null);
      }

      boolean allowed = var10000;
      if (!allowed) {
         String var10002 = String.valueOf(current);
         throw new InvalidLifecycleTransitionException("Organization lifecycle cannot transition from " + var10002 + " to " + String.valueOf(target));
      } else {
         organization.setStatus(target);
         switch (target) {
            case PENDING:
            case TERMINATED:
               throw new IllegalStateException("Unsupported lifecycle target: " + String.valueOf(target));
            case TRIAL:
               organization.setTrialStartedAt(now);
               organization.setTrialEndsAt(now.plus(Duration.ofDays(14L)));
               break;
            case ACTIVE:
               if (organization.getActivatedAt() == null) {
                  organization.setActivatedAt(now);
               }
               break;
            case SUSPENDED:
               organization.setSuspendedAt(now);
               break;
            case CANCELLED:
               organization.setCancelledAt(now);
         }

      }
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
