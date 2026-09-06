package com.lexorion.horizon.invitation.dto;

import com.lexorion.horizon.invitation.entity.InvitationStatus;
import com.lexorion.horizon.invitation.entity.OrganizationInvitation;
import com.lexorion.horizon.membership.entity.OrganizationRole;
import java.time.Instant;
import java.util.UUID;

public record InvitationResponse(UUID invitationId, String email, OrganizationRole role, InvitationStatus status, Instant expiresAt, String invitedByEmail, Instant acceptedAt, Instant createdAt) {
   public static InvitationResponse from(OrganizationInvitation invitation, Instant now) {
      InvitationStatus effectiveStatus = invitation.getStatus() == InvitationStatus.PENDING && !invitation.getExpiresAt().isAfter(now) ? InvitationStatus.EXPIRED : invitation.getStatus();
      return new InvitationResponse(invitation.getId(), invitation.getNormalizedEmail(), invitation.getIntendedRole(), effectiveStatus, invitation.getExpiresAt(), invitation.getInvitedBy().getEmail(), invitation.getAcceptedAt(), invitation.getCreatedAt());
   }
}
