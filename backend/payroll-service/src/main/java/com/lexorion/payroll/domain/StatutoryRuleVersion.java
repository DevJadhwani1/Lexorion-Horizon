package com.lexorion.payroll.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.*;

/**
 * Effective-dated statutory rates and ceilings, shared by all tenants and maintained by migration only.
 * Each row records its official source; every value still requires employer review before it is relied on.
 */
@Entity
@Table(name = "payroll_statutory_rule_versions",
        uniqueConstraints = @UniqueConstraint(name = "uk_statutory_rule_version", columnNames = {"scheme", "jurisdiction", "effective_from"}))
@Getter @Setter @NoArgsConstructor
public class StatutoryRuleVersion {
    @Id private UUID id;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private StatutoryScheme scheme;
    @Column(nullable = false, length = 8) private String jurisdiction;
    @Column(name = "effective_from", nullable = false) private LocalDate effectiveFrom;
    @Column(name = "effective_to") private LocalDate effectiveTo;
    @Column(name = "wage_ceiling", precision = 19, scale = 4) private BigDecimal wageCeiling;
    @Column(name = "employee_rate", precision = 9, scale = 4) private BigDecimal employeeRate;
    @Column(name = "employer_rate", precision = 9, scale = 4) private BigDecimal employerRate;
    @Column(name = "pension_rate", precision = 9, scale = 4) private BigDecimal pensionRate;
    @Column(name = "pension_wage_ceiling", precision = 19, scale = 4) private BigDecimal pensionWageCeiling;
    @Column(name = "source_reference", nullable = false, length = 500) private String sourceReference;
    @Column(name = "source_url", length = 500) private String sourceUrl;
    @Column(name = "review_status", nullable = false, length = 32) private String reviewStatus;
}
