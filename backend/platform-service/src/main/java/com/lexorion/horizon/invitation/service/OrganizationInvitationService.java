package com.lexorion.horizon.invitation.service;

import com.lexorion.core.exception.ResourceNotFoundException;
import com.lexorion.horizon.invitation.config.InvitationProperties;
import com.lexorion.horizon.invitation.delivery.InvitationDelivery;
import com.lexorion.horizon.invitation.dto.InvitationAcceptanceResponse;
import com.lexorion.horizon.invitation.dto.InvitationResponse;
import com.lexorion.horizon.invitation.entity.InvitationStatus;
import com.lexorion.horizon.invitation.entity.OrganizationInvitation;
import com.lexorion.horizon.invitation.exception.InvalidInvitationException;
import com.lexorion.horizon.invitation.exception.InvitationConflictException;
import com.lexorion.horizon.invitation.repository.OrganizationInvitationRepository;
import com.lexorion.horizon.membership.entity.MembershipStatus;
import com.lexorion.horizon.membership.entity.OrganizationMembership;
import com.lexorion.horizon.membership.entity.OrganizationRole;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import com.lexorion.core.organization.entity.Organization;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.platform.security.AuthenticatedUser;
import com.lexorion.horizon.tenantaccess.context.TenantAccessContext;
import com.lexorion.horizon.tenantaccess.context.TenantAccessContextHolder;
import com.lexorion.core.user.entity.User;
import com.lexorion.core.user.repository.UserRepository;
import com.lexorion.core.user.service.UserService;
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
   private final com.lexorion.platform.domain.context.OrganizationContextHolder organizationContext;

   public OrganizationInvitationService(TenantAccessContextHolder tenantContextHolder, OrganizationInvitationRepository invitationRepository, OrganizationMembershipRepository membershipRepository, OrganizationRepository organizationRepository, UserRepository userRepository, InvitationTokenService tokenService, InvitationDelivery delivery, InvitationProperties properties, Clock clock, com.lexorion.platform.domain.context.OrganizationContextHolder organizationContext) {
      this.tenantContextHolder = tenantContextHolder;
      this.invitationRepository = invitationRepository;
      this.membershipRepository = membershipRepository;
      this.organizationRepository = organizationRepository;
      this.userRepository = userRepository;
      this.tokenService = tokenService;
      this.delivery = delivery;
      this.properties = properties;
      this.clock = clock;
      this.organizationContext = organizationContext;
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
         this.deliver(invitation, rawToken);
         return InvitationResponse.from(invitation, now);
      }
   }

   // SMTP acceptance does not prove inbox delivery. On failure the invitation stays visible and retryable.
   private void deliver(OrganizationInvitation invitation, String rawToken) {
      invitation.setDeliveryAttemptedAt(clock.instant());
      try {
         delivery.deliver(new InvitationDelivery.InvitationMessage(invitation.getNormalizedEmail(),
               invitation.getOrganization().getName(), invitation.getOrganization().getSlug(), rawToken, invitation.getExpiresAt()));
         invitation.setDeliveryStatus("SUBMITTED");
         invitation.setDeliveryError(null);
      } catch (RuntimeException failure) {
         invitation.setDeliveryStatus("FAILED");
         // Provider exceptions may contain credentials or recipient/token data; do not persist or return them.
         invitation.setDeliveryError("Email submission failed. Check SMTP configuration and retry delivery.");
      }
      invitationRepository.saveAndFlush(invitation);
   }

   public InvitationResponse resend(UUID invitationId) {
      TenantAccessContext actor = requireAdministrator();
      lockMutableOrganization(actor.organizationId());
      OrganizationInvitation invitation = invitationRepository.findTenantInvitation(invitationId, actor.organizationId())
            .orElseThrow(() -> ResourceNotFoundException.of("Invitation", invitationId));
      if (invitation.getStatus() != InvitationStatus.PENDING || !invitation.getExpiresAt().isAfter(clock.instant()))
         throw new InvitationConflictException("Only an unexpired pending invitation can be resent. Create a new invitation instead.");
      String token = tokenService.generate();
      invitation.setTokenHash(tokenService.hash(token));
      deliver(invitation, token);
      return InvitationResponse.from(invitation, clock.instant());
   }

   @Transactional(readOnly = true)
   public InvitationPreview preview(String token) {
      OrganizationInvitation invitation = pending(token);
      return new InvitationPreview(invitation.getNormalizedEmail(), invitation.getOrganization().getSlug(),
            invitation.getOrganization().getName(), userRepository.findByEmailIgnoreCase(invitation.getNormalizedEmail()).isPresent());
   }

   OrganizationInvitation pending(String token) {
      OrganizationInvitation invitation = invitationRepository.findByTokenHash(tokenService.hash(token))
            .orElseThrow(() -> new InvalidInvitationException("Invitation is invalid"));
      if (invitation.getStatus() != InvitationStatus.PENDING || !invitation.getExpiresAt().isAfter(clock.instant()))
         throw new InvitationConflictException("Invitation has expired or is no longer pending");
      if (!invitation.getOrganization().getStatus().allowsTenantAccess())
         throw new InvitationConflictException("The invited organization is not available");
      requireMatchingOrganization(invitation);
      return invitation;
   }

   public record InvitationPreview(String email, String organizationSlug, String organizationName, boolean accountExists) {}

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
      requireMatchingOrganization(snapshot);
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

   private void requireMatchingOrganization(OrganizationInvitation invitation) {
      organizationContext.get().ifPresent(context -> {
         if (!context.organizationId().equals(invitation.getOrganization().getId()))
            throw new AccessDeniedException("Invitation does not belong to the selected organization");
      });
   }

   private TenantAccessContext requireAdministrator() {
      TenantAccessContext context = (TenantAccessContext)this.tenantContextHolder.get().orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
      if (context.membershipRole() != OrganizationRole.ADMIN) {
         throw new AccessDeniedException("Organization invitations require ADMIN");
      } else {
         return context;
      }
   }

   private void authorizeRole(OrganizationRole actor, OrganizationRole intendedRole) {
      // ADMIN is the highest organization authority and may invite any active role.
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
