package com.lexorion.platform.platformaccess.entity;

import com.lexorion.platform.config.Auditable;
import com.lexorion.platform.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;
import lombok.Generated;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(
   name = "platform_access",
   uniqueConstraints = {@UniqueConstraint(
   name = "uk_platform_access_user",
   columnNames = {"user_id"}
)}
)
public class PlatformAccess extends Auditable {
   @Id
   @UuidGenerator
   @Column(
      nullable = false,
      updatable = false
   )
   private UUID id;
   @OneToOne(
      fetch = FetchType.LAZY,
      optional = false
   )
   @JoinColumn(
      name = "user_id",
      nullable = false,
      unique = true
   )
   private User user;
   @Enumerated(EnumType.STRING)
   @Column(
      nullable = false,
      length = 20
   )
   private PlatformRole role;
   @Enumerated(EnumType.STRING)
   @Column(
      nullable = false,
      length = 20
   )
   private PlatformAccessStatus status;
   @Column(
      name = "granted_at",
      nullable = false
   )
   private Instant grantedAt;

   @Generated
   public UUID getId() {
      return this.id;
   }

   @Generated
   public User getUser() {
      return this.user;
   }

   @Generated
   public PlatformRole getRole() {
      return this.role;
   }

   @Generated
   public PlatformAccessStatus getStatus() {
      return this.status;
   }

   @Generated
   public Instant getGrantedAt() {
      return this.grantedAt;
   }

   @Generated
   public void setId(final UUID id) {
      this.id = id;
   }

   @Generated
   public void setUser(final User user) {
      this.user = user;
   }

   @Generated
   public void setRole(final PlatformRole role) {
      this.role = role;
   }

   @Generated
   public void setStatus(final PlatformAccessStatus status) {
      this.status = status;
   }

   @Generated
   public void setGrantedAt(final Instant grantedAt) {
      this.grantedAt = grantedAt;
   }

   @Generated
   public PlatformAccess() {
      this.status = PlatformAccessStatus.ACTIVE;
   }
}
