package com.lexorion.payroll.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import lombok.*;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name="payroll_pay_runs",uniqueConstraints=@UniqueConstraint(name="uk_pay_run_workspace_key",columnNames={"workspace_id","pay_run_key"}),indexes={@Index(name="idx_pay_run_workspace_status",columnList="workspace_id,pay_run_status"),@Index(name="idx_pay_run_workspace_key",columnList="workspace_id,pay_run_key")})
@Check(constraints="period_start <= period_end and gross_total >= 0 and deduction_total >= 0 and net_total >= 0")
@Getter @Setter @NoArgsConstructor
public class PayRun extends Auditable {
 @Id @UuidGenerator private UUID id;
 @ManyToOne(fetch=FetchType.LAZY,optional=false)@JoinColumn(name="workspace_id",nullable=false,updatable=false)private PayrollWorkspace workspace;
 @Column(name="pay_run_key",nullable=false,updatable=false,length=64)private String payRunKey;
 @Column(name="period_start",nullable=false,updatable=false)private LocalDate periodStart;
 @Column(name="period_end",nullable=false,updatable=false)private LocalDate periodEnd;
 @Column(name="calculation_date",nullable=false,updatable=false)private LocalDate calculationDate;
 @Column(nullable=false,updatable=false,length=3)private String currency;
 @Enumerated(EnumType.STRING)@Column(name="pay_run_status",nullable=false,length=16)private PayRunStatus status;
 @Column(name="gross_total",nullable=false,precision=19,scale=4)private BigDecimal grossTotal;
 @Column(name="deduction_total",nullable=false,precision=19,scale=4)private BigDecimal deductionTotal;
 @Column(name="net_total",nullable=false,precision=19,scale=4)private BigDecimal netTotal;
 @Column(name="finalized_at")private Instant finalizedAt;
 @OneToMany(mappedBy="payRun",cascade=CascadeType.ALL,orphanRemoval=false)@OrderBy("employeeCode ASC")private List<PayRunEmployee> employees=new ArrayList<>();
}
