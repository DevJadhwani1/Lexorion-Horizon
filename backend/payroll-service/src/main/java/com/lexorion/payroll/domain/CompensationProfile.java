package com.lexorion.payroll.domain;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.*;
import lombok.*;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Check(constraints = "effective_to is null or effective_to >= effective_from")
@Table(name = "compensation_profiles",
        uniqueConstraints = @UniqueConstraint(name = "uk_profile_employee_key", columnNames = {"payroll_employee_id", "profile_key"}),
        indexes = @Index(name = "idx_profile_employee_dates", columnList = "payroll_employee_id,effective_from,effective_to"))
@Getter @Setter @NoArgsConstructor
public class CompensationProfile extends Auditable {
    @Id @UuidGenerator private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payroll_employee_id", nullable = false, updatable = false)
    private PayrollEmployee payrollEmployee;
    @Column(name = "profile_key", nullable = false, updatable = false, length = 64)
    private String profileKey;
    @Column(nullable = false, updatable = false, length = 3) private String currency;
    @Column(name = "effective_from", nullable = false, updatable = false) private LocalDate effectiveFrom;
    @Column(name = "effective_to", updatable = false) private LocalDate effectiveTo;
    @Enumerated(EnumType.STRING) @Column(name = "profile_status", nullable = false, updatable = false, length = 16)
    private CompensationProfileStatus status;
    @Column(name = "source_template_key", updatable = false, length = 64) private String sourceTemplateKey;
    @Column(name = "source_template_version", updatable = false) private Integer sourceTemplateVersion;
    @OneToMany(mappedBy = "profile", cascade = CascadeType.ALL, orphanRemoval = false)
    @OrderBy("id ASC") private List<ComponentAssignment> assignments = new ArrayList<>();
}
