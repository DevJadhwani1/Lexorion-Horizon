package com.lexorion.platform.invitation.entity;

import com.lexorion.platform.config.Auditable;
import com.lexorion.platform.membership.entity.OrganizationRole;
import com.lexorion.platform.organization.entity.Organization;
import com.lexorion.platform.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Generated;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(
   name = "organization_invitations"
)
public class OrganizationInvitation extends Auditable {
   @Id
   @UuidGenerator
   @Column(
      nullable = false,
      updatable = false
   )
   private UUID id;
   @ManyToOne(
      fetch = FetchType.LAZY,
      optional = false
   )
   @JoinColumn(
      name = "organization_id",
      nullable = false
   )
   private Organization organization;
   @Column(
      name = "normalized_email",
      nullable = false,
      length = 255
   )
   private String normalizedEmail;
   @Enumerated(EnumType.STRING)
   @Column(
      name = "intended_role",
      nullable = false,
      length = 20
   )
   private OrganizationRole intendedRole;
   @Column(
      name = "token_hash",
      nullable = false,
      unique = true,
      length = 64
   )
   private String tokenHash;
   @Enumerated(EnumType.STRING)
   @Column(
      nullable = false,
      length = 20
   )
   private InvitationStatus status;
   @Column(
      name = "expires_at",
      nullable = false
   )
   private Instant expiresAt;
   @ManyToOne(
      fetch = FetchType.LAZY,
      optional = false
   )
   @JoinColumn(
      name = "invited_by",
      nullable = false
   )
   private User invitedBy;
   @Column(
      name = "accepted_at"
   )
   private Instant acceptedAt;

   @Generated
   public UUID getId() {
      return this.id;
   }

   @Generated
   public Organization getOrganization() {
      return this.organization;
   }

   @Generated
   public String getNormalizedEmail() {
      return this.normalizedEmail;
   }

   @Generated
   public OrganizationRole getIntendedRole() {
      return this.intendedRole;
   }

   @Generated
   public String getTokenHash() {
      return this.tokenHash;
   }

   @Generated
   public InvitationStatus getStatus() {
      return this.status;
   }

   @Generated
   public Instant getExpiresAt() {
      return this.expiresAt;
   }

   @Generated
   public User getInvitedBy() {
      return this.invitedBy;
   }

   @Generated
   public Instant getAcceptedAt() {
      return this.acceptedAt;
   }

   @Generated
   public void setId(final UUID id) {
      this.id = id;
   }

   @Generated
   public void setOrganization(final Organization organization) {
      this.organization = organization;
   }

   @Generated
   public void setNormalizedEmail(final String normalizedEmail) {
      this.normalizedEmail = normalizedEmail;
   }

   @Generated
   public void setIntendedRole(final OrganizationRole intendedRole) {
      this.intendedRole = intendedRole;
   }

   @Generated
   public void setTokenHash(final String tokenHash) {
      this.tokenHash = tokenHash;
   }

   @Generated
   public void setStatus(final InvitationStatus status) {
      this.status = status;
   }

   @Generated
   public void setExpiresAt(final Instant expiresAt) {
      this.expiresAt = expiresAt;
   }

   @Generated
   public void setInvitedBy(final User invitedBy) {
      this.invitedBy = invitedBy;
   }

   @Generated
   public void setAcceptedAt(final Instant acceptedAt) {
      this.acceptedAt = acceptedAt;
   }

   @Generated
   public OrganizationInvitation() {
      this.status = InvitationStatus.PENDING;
   }
}
