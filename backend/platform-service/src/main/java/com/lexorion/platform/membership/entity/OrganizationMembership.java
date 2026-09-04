package com.lexorion.platform.membership.entity;

import com.lexorion.platform.config.Auditable;
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
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;
import lombok.Generated;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(
   name = "organization_memberships",
   uniqueConstraints = {@UniqueConstraint(
   name = "uk_org_membership_org_user",
   columnNames = {"organization_id", "user_id"}
)}
)
public class OrganizationMembership extends Auditable {
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
   @ManyToOne(
      fetch = FetchType.LAZY,
      optional = false
   )
   @JoinColumn(
      name = "user_id",
      nullable = false
   )
   private User user;
   @Enumerated(EnumType.STRING)
   @Column(
      nullable = false,
      length = 20
   )
   private OrganizationRole role;
   @Enumerated(EnumType.STRING)
   @Column(
      nullable = false,
      length = 20
   )
   private MembershipStatus status;
   @Column(
      name = "joined_at",
      nullable = false
   )
   private Instant joinedAt;

   @Generated
   public UUID getId() {
      return this.id;
   }

   @Generated
   public Organization getOrganization() {
      return this.organization;
   }

   @Generated
   public User getUser() {
      return this.user;
   }

   @Generated
   public OrganizationRole getRole() {
      return this.role;
   }

   @Generated
   public MembershipStatus getStatus() {
      return this.status;
   }

   @Generated
   public Instant getJoinedAt() {
      return this.joinedAt;
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
   public void setUser(final User user) {
      this.user = user;
   }

   @Generated
   public void setRole(final OrganizationRole role) {
      this.role = role;
   }

   @Generated
   public void setStatus(final MembershipStatus status) {
      this.status = status;
   }

   @Generated
   public void setJoinedAt(final Instant joinedAt) {
      this.joinedAt = joinedAt;
   }

   @Generated
   public OrganizationMembership() {
      this.role = OrganizationRole.MEMBER;
      this.status = MembershipStatus.ACTIVE;
   }
}
