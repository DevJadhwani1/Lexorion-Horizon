package com.lexorion.payroll.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Check(constraints = "configured_value >= 0 and (percentage_basis is null or percentage_basis <> '')")
@Table(name = "payroll_salary_template_version_components",
        uniqueConstraints = @UniqueConstraint(name = "uk_salary_template_version_component", columnNames = {"version_id", "component_definition_id"}),
        indexes = @Index(name = "idx_salary_template_version_component", columnList = "version_id,display_sequence"))
@Getter @Setter @NoArgsConstructor
public class SalaryTemplateVersionComponent extends Auditable {
    @Id @UuidGenerator private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "version_id", nullable = false, updatable = false)
    private SalaryTemplateVersion version;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "component_definition_id", nullable = false, updatable = false)
    private ComponentDefinition definition;
    @Column(name = "component_key", nullable = false, updatable = false, length = 64) private String componentKey;
    @Column(name = "configured_value", nullable = false, precision = 19, scale = 4) private BigDecimal value;
    @Column(name = "percentage_basis", length = 64) private String percentageBasis;
    @Column(name = "display_sequence", nullable = false) private int displaySequence;
}
