package com.lexorion.payroll.domain;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

/**
 * Payment details, tax profile and statutory elections for one payroll employee. Created on first save, so
 * employees enrolled before this existed simply have no profile. Bank account, PAN, UAN and ESI IP number are
 * write-only through the API and are only ever returned masked.
 */
@Entity
@Table(name = "payroll_statutory_profiles",
        uniqueConstraints = @UniqueConstraint(name = "uk_statutory_profile_employee", columnNames = "payroll_employee_id"),
        indexes = @Index(name = "idx_statutory_profile_workspace", columnList = "workspace_id"))
@Getter @Setter @NoArgsConstructor
public class StatutoryProfile extends Auditable {
    @Id @UuidGenerator private UUID id;
    @Version @Column(nullable = false) private long version;
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "payroll_employee_id", nullable = false, updatable = false) private PayrollEmployee payrollEmployee;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false, updatable = false) private PayrollWorkspace workspace;

    @Enumerated(EnumType.STRING) @Column(name = "payment_method", length = 20) private PaymentMethod paymentMethod;
    @Column(name = "bank_account_holder", length = 150) private String bankAccountHolder;
    @Column(name = "bank_account_number", length = 34) private String bankAccountNumber;
    @Column(name = "bank_ifsc", length = 11) private String bankIfsc;
    @Column(name = "bank_name", length = 120) private String bankName;
    @Column(name = "bank_verified", nullable = false) private boolean bankVerified;

    @Column(length = 10) private String pan;
    @Column(name = "pan_verified", nullable = false) private boolean panVerified;
    @Enumerated(EnumType.STRING) @Column(name = "tax_regime", length = 20) private TaxRegime taxRegime;

    @Enumerated(EnumType.STRING) @Column(name = "pf_applicability", length = 20) private StatutoryApplicability pfApplicability;
    @Column(length = 12) private String uan;
    @Column(name = "pf_member_since") private LocalDate pfMemberSince;
    @Column(name = "pf_higher_wages_opt_in", nullable = false) private boolean pfHigherWagesOptIn;
    @Column(name = "pf_verified", nullable = false) private boolean pfVerified;

    @Enumerated(EnumType.STRING) @Column(name = "esi_applicability", length = 20) private StatutoryApplicability esiApplicability;
    @Column(name = "esi_ip_number", length = 10) private String esiIpNumber;
    @Column(name = "esi_verified", nullable = false) private boolean esiVerified;

    @Enumerated(EnumType.STRING) @Column(name = "pt_applicability", length = 20) private StatutoryApplicability ptApplicability;
    @Column(name = "pt_state", length = 6) private String ptState;
    @Enumerated(EnumType.STRING) @Column(name = "lwf_applicability", length = 20) private StatutoryApplicability lwfApplicability;
    @Column(name = "lwf_state", length = 6) private String lwfState;
}
