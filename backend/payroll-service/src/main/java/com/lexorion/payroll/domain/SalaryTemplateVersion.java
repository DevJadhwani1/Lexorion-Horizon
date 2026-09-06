package com.lexorion.payroll.domain;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.*;
import lombok.*;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Check(constraints = "effective_to is null or effective_to >= effective_from")
@Table(name = "payroll_salary_template_versions",
        uniqueConstraints = @UniqueConstraint(name = "uk_salary_template_version_number", columnNames = {"template_id", "version_number"}),
        indexes = @Index(name = "idx_salary_template_version_dates", columnList = "template_id,effective_from,effective_to"))
@Getter @Setter @NoArgsConstructor
public class SalaryTemplateVersion extends Auditable {
    @Id @UuidGenerator private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "template_id", nullable = false, updatable = false)
    private SalaryTemplate template;
    @Column(name = "version_number", nullable = false, updatable = false)
    private int versionNumber;
    @Column(nullable = false, length = 3) private String currency;
    @Enumerated(EnumType.STRING) @Column(name = "pay_frequency", nullable = false, length = 16)
    private PayFrequency payFrequency;
    @Enumerated(EnumType.STRING) @Column(name = "version_status", nullable = false, length = 16)
    private SalaryTemplateVersionStatus status;
    @Column(name = "effective_from", nullable = false) private LocalDate effectiveFrom;
    @Column(name = "effective_to") private LocalDate effectiveTo;
    @OneToMany(mappedBy = "version", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displaySequence ASC, componentKey ASC")
    private List<SalaryTemplateVersionComponent> components = new ArrayList<>();
}
