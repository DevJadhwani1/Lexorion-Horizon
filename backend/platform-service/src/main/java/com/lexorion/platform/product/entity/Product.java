package com.lexorion.platform.product.entity;

import com.lexorion.platform.config.Auditable;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Generated;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(
   name = "products",
   indexes = {@Index(
   name = "idx_products_status",
   columnList = "status"
)}
)
public class Product extends Auditable {
   @Id
   @UuidGenerator
   @Column(
      nullable = false,
      updatable = false
   )
   private UUID id;
   @Column(
      name = "product_key",
      nullable = false,
      unique = true,
      length = 63,
      updatable = false
   )
   private String key;
   @Column(
      nullable = false,
      length = 150
   )
   private String displayName;
   @Column(
      length = 1000
   )
   private String description;
   @Enumerated(EnumType.STRING)
   @Column(
      nullable = false,
      length = 20
   )
   private ProductStatus status;

   @Generated
   public UUID getId() {
      return this.id;
   }

   @Generated
   public String getKey() {
      return this.key;
   }

   @Generated
   public String getDisplayName() {
      return this.displayName;
   }

   @Generated
   public String getDescription() {
      return this.description;
   }

   @Generated
   public ProductStatus getStatus() {
      return this.status;
   }

   @Generated
   public void setId(final UUID id) {
      this.id = id;
   }

   @Generated
   public void setKey(final String key) {
      this.key = key;
   }

   @Generated
   public void setDisplayName(final String displayName) {
      this.displayName = displayName;
   }

   @Generated
   public void setDescription(final String description) {
      this.description = description;
   }

   @Generated
   public void setStatus(final ProductStatus status) {
      this.status = status;
   }

   @Generated
   public Product() {
      this.status = ProductStatus.ACTIVE;
   }
}
