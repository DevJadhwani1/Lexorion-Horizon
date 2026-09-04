package com.lexorion.platform.auth.entity;

import com.lexorion.platform.config.Auditable;
import com.lexorion.platform.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
   name = "refresh_tokens"
)
public class RefreshToken extends Auditable {
   @Id
   @UuidGenerator
   @Column(
      nullable = false,
      updatable = false
   )
   private UUID id;
   @Column(
      name = "token_hash",
      nullable = false,
      unique = true,
      length = 64
   )
   private String tokenHash;
   @ManyToOne(
      fetch = FetchType.LAZY,
      optional = false
   )
   @JoinColumn(
      name = "user_id",
      nullable = false
   )
   private User user;
   @Column(
      name = "expires_at",
      nullable = false
   )
   private Instant expiresAt;
   @Column(
      nullable = false
   )
   private boolean revoked;
   @Column(
      name = "revoked_at"
   )
   private Instant revokedAt;

   @Generated
   public UUID getId() {
      return this.id;
   }

   @Generated
   public String getTokenHash() {
      return this.tokenHash;
   }

   @Generated
   public User getUser() {
      return this.user;
   }

   @Generated
   public Instant getExpiresAt() {
      return this.expiresAt;
   }

   @Generated
   public boolean isRevoked() {
      return this.revoked;
   }

   @Generated
   public Instant getRevokedAt() {
      return this.revokedAt;
   }

   @Generated
   public void setId(final UUID id) {
      this.id = id;
   }

   @Generated
   public void setTokenHash(final String tokenHash) {
      this.tokenHash = tokenHash;
   }

   @Generated
   public void setUser(final User user) {
      this.user = user;
   }

   @Generated
   public void setExpiresAt(final Instant expiresAt) {
      this.expiresAt = expiresAt;
   }

   @Generated
   public void setRevoked(final boolean revoked) {
      this.revoked = revoked;
   }

   @Generated
   public void setRevokedAt(final Instant revokedAt) {
      this.revokedAt = revokedAt;
   }
}
