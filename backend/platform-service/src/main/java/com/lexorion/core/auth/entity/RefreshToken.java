package com.lexorion.core.auth.entity;

import com.lexorion.core.config.Auditable;
import com.lexorion.core.user.entity.User;
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
   @Column(name = "session_id", nullable = false, updatable = false)
   private UUID sessionId;
   @Column(name = "family_id", nullable = false, updatable = false)
   private UUID familyId;
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
   @Column(name = "replaced_by_hash", length = 64)
   private String replacedByHash;

   @Generated
   public UUID getId() {
      return this.id;
   }
   public UUID getSessionId() { return sessionId; }
   public UUID getFamilyId() { return familyId; }
   public String getReplacedByHash() { return replacedByHash; }

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
   public void setSessionId(UUID sessionId) { this.sessionId = sessionId; }
   public void setFamilyId(UUID familyId) { this.familyId = familyId; }
   public void setReplacedByHash(String replacedByHash) { this.replacedByHash = replacedByHash; }

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
