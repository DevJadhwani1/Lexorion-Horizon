package com.lexorion.horizon.entitlement.entity;

import com.lexorion.core.config.Auditable;
import jakarta.persistence.*;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "entitlement_definitions", indexes = @Index(name = "idx_entitlement_definitions_status", columnList = "status"))
@Getter @Setter @NoArgsConstructor
public class EntitlementDefinition extends Auditable {
    @Id @UuidGenerator @Column(nullable = false, updatable = false) private UUID id;
    @Column(name = "entitlement_key", nullable = false, unique = true, length = 150, updatable = false) private String key;
    @Column(nullable = false, length = 150) private String displayName;
    @Column(length = 1000) private String description;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20, updatable = false) private EntitlementValueType valueType;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private CatalogStatus status = CatalogStatus.ACTIVE;
}
