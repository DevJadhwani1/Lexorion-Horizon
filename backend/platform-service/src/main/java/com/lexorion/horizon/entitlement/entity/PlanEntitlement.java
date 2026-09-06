package com.lexorion.horizon.entitlement.entity;

import com.lexorion.core.config.Auditable;
import jakarta.persistence.*;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "plan_entitlements", uniqueConstraints = @UniqueConstraint(name = "uk_plan_entitlement", columnNames = {"plan_id", "entitlement_definition_id"}), indexes = @Index(name = "idx_plan_entitlements_plan", columnList = "plan_id"))
@Getter @Setter @NoArgsConstructor
public class PlanEntitlement extends Auditable {
    @Id @UuidGenerator @Column(nullable = false, updatable = false) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "plan_id", nullable = false, updatable = false) private Plan plan;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "entitlement_definition_id", nullable = false, updatable = false) private EntitlementDefinition definition;
    @Column(name = "boolean_value") private Boolean booleanValue;
    @Column(name = "integer_value") private Integer integerValue;
}
