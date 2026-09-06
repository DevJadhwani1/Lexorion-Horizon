package com.lexorion.horizon.entitlement.entity;

import com.lexorion.core.config.Auditable;
import com.lexorion.horizon.product.entity.Product;
import jakarta.persistence.*;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "plans", indexes = {@Index(name = "idx_plans_product", columnList = "product_id"), @Index(name = "idx_plans_status", columnList = "status")})
@Getter @Setter @NoArgsConstructor
public class Plan extends Auditable {
    @Id @UuidGenerator @Column(nullable = false, updatable = false) private UUID id;
    @Column(name = "plan_key", nullable = false, unique = true, length = 100, updatable = false) private String key;
    @Column(nullable = false, length = 150) private String displayName;
    @Column(length = 1000) private String description;
    // Null denotes a cross-product commercial plan; retained for legacy assignments.
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "product_id", updatable = false) private Product product;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private CatalogStatus status = CatalogStatus.ACTIVE;
}
