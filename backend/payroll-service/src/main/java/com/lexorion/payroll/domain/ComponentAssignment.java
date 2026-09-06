package com.lexorion.payroll.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Check(constraints = "configured_value >= 0")
@Table(name = "compensation_component_assignments",
        uniqueConstraints = @UniqueConstraint(name = "uk_assignment_profile_component", columnNames = {"profile_id", "component_definition_id"}),
        indexes = @Index(name = "idx_assignment_profile", columnList = "profile_id"))
@Getter @Setter @NoArgsConstructor
public class ComponentAssignment extends Auditable {
    @Id @UuidGenerator private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "profile_id", nullable = false, updatable = false) private CompensationProfile profile;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "component_definition_id", nullable = false, updatable = false) private ComponentDefinition definition;
    @Column(name = "configured_value", nullable = false, precision = 19, scale = 4, updatable = false)
    private BigDecimal value;
    @Column(name = "component_key", nullable = false, updatable = false, length = 64) private String componentKey;
    @Column(name = "display_name", nullable = false, updatable = false, length = 150) private String displayName;
    @Enumerated(EnumType.STRING) @Column(name = "component_category", nullable = false, updatable = false, length = 16) private ComponentCategory category;
    @Enumerated(EnumType.STRING) @Column(name = "amount_type", nullable = false, updatable = false, length = 20) private AmountType amountType;
    @Enumerated(EnumType.STRING) @Column(name = "occurrence_type", nullable = false, updatable = false, length = 16) private OccurrenceType occurrenceType;
    @Enumerated(EnumType.STRING) @Column(name = "taxability", nullable = false, updatable = false, length = 16) private Taxability taxability;
    @Column(name = "percentage_basis", updatable = false, length = 64) private String percentageBasis;
}
