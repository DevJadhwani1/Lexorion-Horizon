package com.lexorion.platform.config;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import java.time.Instant;
import lombok.Generated;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@MappedSuperclass
@EntityListeners({AuditingEntityListener.class})
public abstract class Auditable {
   @CreatedDate
   @Column(
      nullable = false,
      updatable = false
   )
   private Instant createdAt;
   @LastModifiedDate
   @Column(
      nullable = false
   )
   private Instant updatedAt;

   @Generated
   public Instant getCreatedAt() {
      return this.createdAt;
   }

   @Generated
   public Instant getUpdatedAt() {
      return this.updatedAt;
   }
}
