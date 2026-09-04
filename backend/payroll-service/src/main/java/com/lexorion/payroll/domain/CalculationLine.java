package com.lexorion.payroll.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "payroll_calculation_lines", indexes = @Index(name = "idx_calculation_line_calculation", columnList = "calculation_id"))
@Check(constraints = "configured_value >= 0 and calculated_amount >= 0")
@Getter @Setter @NoArgsConstructor
public class CalculationLine extends Auditable {
    @Id @UuidGenerator private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "calculation_id", nullable = false, updatable = false) private Calculation calculation;
    @Column(name = "component_key", nullable = false, updatable = false, length = 64) private String componentKey;
    @Column(name = "display_name", nullable = false, updatable = false, length = 150) private String displayName;
    @Enumerated(EnumType.STRING) @Column(nullable = false, updatable = false, length = 16) private ComponentCategory category;
    @Enumerated(EnumType.STRING) @Column(name = "amount_type", nullable = false, updatable = false, length = 20) private AmountType amountType;
    @Enumerated(EnumType.STRING) @Column(nullable = false, updatable = false, length = 16) private OccurrenceType occurrence;
    @Enumerated(EnumType.STRING) @Column(nullable = false, updatable = false, length = 16) private Taxability taxability;
    @Column(name = "configured_value", nullable = false, updatable = false, precision = 19, scale = 4) private BigDecimal configuredValue;
    @Column(name = "calculated_amount", nullable = false, updatable = false, precision = 19, scale = 4) private BigDecimal calculatedAmount;
    @Column(nullable = false, updatable = false, length = 3) private String currency;
}
