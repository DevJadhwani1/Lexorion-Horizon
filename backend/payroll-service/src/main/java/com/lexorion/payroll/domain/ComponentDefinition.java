package com.lexorion.payroll.domain;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "payroll_component_definitions",
        uniqueConstraints = @UniqueConstraint(name = "uk_component_workspace_key", columnNames = {"workspace_id", "component_key"}),
        indexes = @Index(name = "idx_component_workspace_status", columnList = "workspace_id,component_status"))
@Getter @Setter @NoArgsConstructor
public class ComponentDefinition extends Auditable {
    @Id @UuidGenerator private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false, updatable = false)
    private PayrollWorkspace workspace;
    @Column(name = "component_key", nullable = false, updatable = false, length = 64)
    private String componentKey;
    @Column(name = "display_name", nullable = false, length = 150)
    private String displayName;
    @Enumerated(EnumType.STRING) @Column(nullable = false, updatable = false, length = 16)
    private ComponentCategory category;
    @Enumerated(EnumType.STRING) @Column(name = "amount_type", nullable = false, updatable = false, length = 20)
    private AmountType amountType;
    @Enumerated(EnumType.STRING) @Column(name = "occurrence_type", nullable = false, updatable = false, length = 16)
    private OccurrenceType occurrenceType;
    @Enumerated(EnumType.STRING) @Column(nullable = false, updatable = false, length = 16)
    private Taxability taxability;
    @Enumerated(EnumType.STRING) @Column(name = "component_status", nullable = false, length = 16)
    private ComponentStatus status;
}
