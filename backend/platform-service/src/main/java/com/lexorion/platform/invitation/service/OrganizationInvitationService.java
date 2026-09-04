package com.lexorion.platform.invitation.service;

import com.lexorion.platform.exception.ResourceNotFoundException;
import com.lexorion.platform.invitation.config.InvitationProperties;
import com.lexorion.platform.invitation.delivery.InvitationDelivery;
import com.lexorion.platform.invitation.dto.InvitationAcceptanceResponse;
import com.lexorion.platform.invitation.dto.InvitationResponse;
import com.lexorion.platform.invitation.entity.InvitationStatus;
import com.lexorion.platform.invitation.entity.OrganizationInvitation;
import com.lexorion.platform.invitation.exception.InvalidInvitationException;
import com.lexorion.platform.invitation.exception.InvitationConflictException;
import com.lexorion.platform.invitation.repository.OrganizationInvitationRepository;
import com.lexorion.platform.membership.entity.MembershipStatus;
import com.lexorion.platform.membership.entity.OrganizationMembership;
import com.lexorion.platform.membership.entity.OrganizationRole;
import com.lexorion.platform.membership.repository.OrganizationMembershipRepository;
import com.lexorion.platform.organization.entity.Organization;
import com.lexorion.platform.organization.repository.OrganizationRepository;
import com.lexorion.platform.security.AuthenticatedUser;
import com.lexorion.platform.tenantaccess.context.TenantAccessContext;
import com.lexorion.platform.tenantaccess.context.TenantAccessContextHolder;
import com.lexorion.platform.user.entity.User;
import com.lexorion.platform.user.repository.UserRepository;
import com.lexorion.platform.user.service.UserService;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class OrganizationInvitationService {
   private final TenantAccessContextHolder tenantContextHolder;
   private final OrganizationInvitationRepository invitationRepository;
   private final OrganizationMembershipRepository membershipRepository;
   private final OrganizationRepository organizationRepository;
   private final UserRepository userRepository;
   private final InvitationTokenService tokenService;
   private final InvitationDelivery delivery;
   private final InvitationProperties properties;
   private final Clock clock;

   public OrganizationInvitationService(TenantAccessContextHolder tenantContextHolder, OrganizationInvitationRepository invitationRepository, OrganizationMembershipRepository membershipRepository, OrganizationRepository organizationRepository, UserRepository userRepository, InvitationTokenService tokenService, InvitationDelivery delivery, InvitationProperties properties, Clock clock) {
      this.tenantContextHolder = tenantContextHolder;
      this.invitationRepository = invitationRepository;
      this.membershipRepository = membershipRepository;
      this.organizationRepository = organizationRepository;
      this.userRepository = userRepository;
      this.tokenService = tokenService;
      this.delivery = delivery;
      this.properties = properties;
      this.clock = clock;
   }

   public InvitationResponse create(String email, OrganizationRole role) {
      TenantAccessContext actor = this.requireAdministrator();
      this.authorizeRole(actor.membershipRole(), role);
      Organization organization = this.lockMutableOrganization(actor.organizationId());
      String normalizedEmail = UserService.normalizeEmail(email);
      if (this.userRepository.findByEmailIgnoreCase(normalizedEmail).filter((user) -> this.membershipRepository.existsByOrganizationIdAndUserId(organization.getId(), user.getId())).isPresent()) {
         throw new InvitationConflictException("The invited email already belongs to this organization");
      } else {
         Instant now = this.clock.instant();
         this.invitationRepository.findByOrganizationIdAndNormalizedEmailAndStatus(organization.getId(), normalizedEmail, InvitationStatus.PENDING).ifPresent((existing) -> {
            if (existing.getExpiresAt().isAfter(now)) {
               throw new InvitationConflictException("A pending invitation already exists for this email");
            } else {
               existing.setStatus(InvitationStatus.EXPIRED);
               this.invitationRepository.save(existing);
            }
         });
         User inviter = (User)this.userRepository.findById(actor.userId()).orElseThrow(() -> ResourceNotFoundException.of("User", actor.userId()));
         String rawToken = this.tokenService.generate();
         OrganizationInvitation invitation = new OrganizationInvitation();
         invitation.setOrganization(organization);
         invitation.setNormalizedEmail(normalizedEmail);
         invitation.setIntendedRole(role);
         invitation.setTokenHash(this.tokenService.hash(rawToken));
         invitation.setStatus(InvitationStatus.PENDING);
         invitation.setExpiresAt(now.plus(this.properties.ttl()));
         invitation.setInvitedBy(inviter);
         invitation = (OrganizationInvitation)this.invitationRepository.saveAndFlush(invitation);
         this.delivery.deliver(new InvitationDelivery.InvitationMessage(normalizedEmail, organization.getName(), organization.getSlug(), rawToken, invitation.getExpiresAt()));
         return InvitationResponse.from(invitation, now);
      }
   }

   @Transactional(
      readOnly = true
   )
   public List<InvitationResponse> list() {
      TenantAccessContext actor = this.requireAdministrator();
      Instant now = this.clock.instant();
      return this.invitationRepository.findTenantInvitations(actor.organizationId()).stream().map((invitation) -> InvitationResponse.from(invitation, now)).toList();
   }

   public void revoke(UUID invitationId) {
      TenantAccessContext actor = this.requireAdministrator();
      this.lockMutableOrganization(actor.organizationId());
      OrganizationInvitation invitation = (OrganizationInvitation)this.invitationRepository.findTenantInvitation(invitationId, actor.organizationId()).orElseThrow(() -> ResourceNotFoundException.of("Invitation", invitationId));
      this.authorizeRole(actor.membershipRole(), invitation.getIntendedRole());
      if (invitation.getStatus() != InvitationStatus.PENDING) {
         throw new InvitationConflictException("Only a pending invitation can be revoked");
      } else if (!invitation.getExpiresAt().isAfter(this.clock.instant())) {
         invitation.setStatus(InvitationStatus.EXPIRED);
         this.invitationRepository.save(invitation);
      } else {
         invitation.setStatus(InvitationStatus.REVOKED);
         this.invitationRepository.save(invitation);
      }
   }

   public InvitationAcceptanceResponse accept(String rawToken, AuthenticatedUser authenticatedUser) {
      String tokenHash = this.tokenService.hash(rawToken);
      OrganizationInvitation snapshot = (OrganizationInvitation)this.invitationRepository.findByTokenHash(tokenHash).orElseThrow(() -> new InvalidInvitationException("Invitation is invalid"));
      Organization organization = this.lockMutableOrganizationForAcceptance(snapshot.getOrganization().getId());
      OrganizationInvitation invitation = (OrganizationInvitation)this.invitationRepository.findByTokenHashForUpdate(tokenHash).orElseThrow(() -> new InvalidInvitationException("Invitation is invalid"));
      Instant now = this.clock.instant();
      if (invitation.getStatus() != InvitationStatus.PENDING) {
         throw new InvitationConflictException("Invitation is no longer pending");
      } else if (!invitation.getExpiresAt().isAfter(now)) {
         throw new InvitationConflictException("Invitation has expired");
      } else {
         String authenticatedEmail = authenticatedUser.email().trim().toLowerCase(Locale.ROOT);
         if (!MessageDigestSupport.constantTimeEquals(authenticatedEmail, invitation.getNormalizedEmail())) {
            throw new AccessDeniedException("Invitation email does not match the authenticated user");
         } else if (this.membershipRepository.existsByOrganizationIdAndUserId(organization.getId(), authenticatedUser.userId())) {
            throw new InvitationConflictException("A membership already exists for this organization");
         } else {
            User user = (User)this.userRepository.findById(authenticatedUser.userId()).orElseThrow(() -> ResourceNotFoundException.of("User", authenticatedUser.userId()));
            OrganizationMembership membership = new OrganizationMembership();
            membership.setOrganization(organization);
            membership.setUser(user);
            membership.setRole(invitation.getIntendedRole());
            membership.setStatus(MembershipStatus.ACTIVE);
            membership.setJoinedAt(now);
            this.membershipRepository.saveAndFlush(membership);
            invitation.setStatus(InvitationStatus.ACCEPTED);
            invitation.setAcceptedAt(now);
            this.invitationRepository.saveAndFlush(invitation);
            return new InvitationAcceptanceResponse(organization.getSlug(), organization.getName(), invitation.getIntendedRole());
         }
      }
   }

   private TenantAccessContext requireAdministrator() {
      TenantAccessContext context = (TenantAccessContext)this.tenantContextHolder.get().orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
      if (context.membershipRole() != OrganizationRole.OWNER && context.membershipRole() != OrganizationRole.ADMIN) {
         throw new AccessDeniedException("Organization invitations require OWNER or ADMIN");
      } else {
         return context;
      }
   }

   private void authorizeRole(OrganizationRole actor, OrganizationRole intendedRole) {
      if (actor == OrganizationRole.ADMIN && (intendedRole == OrganizationRole.OWNER || intendedRole == OrganizationRole.ADMIN)) {
         throw new AccessDeniedException("ADMIN may only invite or revoke MANAGER and MEMBER roles");
      }
   }

   private Organization lockMutableOrganization(UUID organizationId) {
      Organization organization = (Organization)this.organizationRepository.findByIdForUpdate(organizationId).orElseThrow(() -> ResourceNotFoundException.of("Organization", organizationId));
      if (!organization.getStatus().allowsTenantManagement()) {
         throw new InvitationConflictException("Invitation management requires a TRIAL or ACTIVE organization");
      } else {
         return organization;
      }
   }

   private Organization lockMutableOrganizationForAcceptance(UUID organizationId) {
      Organization organization = (Organization)this.organizationRepository.findByIdForUpdate(organizationId).orElseThrow(() -> new InvalidInvitationException("Invitation is invalid"));
      if (!organization.getStatus().allowsTenantAccess()) {
         throw new InvitationConflictException("The invited organization is not available");
      } else {
         return organization;
      }
   }
}
