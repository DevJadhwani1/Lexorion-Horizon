package com.lexorion.payroll.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import lombok.*;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "payroll_calculations", indexes = {
        @Index(name = "idx_calculation_workspace", columnList = "workspace_id"),
        @Index(name = "idx_calculation_employee_date", columnList = "workspace_id,employee_code,calculation_date")})
@Check(constraints = "gross_amount >= 0 and deduction_amount >= 0 and net_amount >= 0")
@Getter @Setter @NoArgsConstructor
public class Calculation extends Auditable {
    @Id @UuidGenerator private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false, updatable = false) private PayrollWorkspace workspace;
    @Column(name = "employee_code", nullable = false, updatable = false, length = 64) private String employeeCode;
    @Column(name = "calculation_date", nullable = false, updatable = false) private LocalDate calculationDate;
    @Column(nullable = false, updatable = false, length = 3) private String currency;
    @Column(name = "gross_amount", nullable = false, updatable = false, precision = 19, scale = 4) private BigDecimal grossAmount;
    @Column(name = "deduction_amount", nullable = false, updatable = false, precision = 19, scale = 4) private BigDecimal deductionAmount;
    @Column(name = "net_amount", nullable = false, updatable = false, precision = 19, scale = 4) private BigDecimal netAmount;
    @OneToMany(mappedBy = "calculation", cascade = CascadeType.ALL, orphanRemoval = false)
    @OrderBy("componentKey ASC") private List<CalculationLine> lines = new ArrayList<>();
}
