package com.lexorion.payroll.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.*;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name="payroll_pay_run_employees",uniqueConstraints={@UniqueConstraint(name="uk_pay_run_employee",columnNames={"pay_run_id","payroll_employee_id"}),@UniqueConstraint(name="uk_pay_run_calculation",columnNames="calculation_id")},indexes=@Index(name="idx_pay_run_employee",columnList="pay_run_id,employee_code"))
@Check(constraints="gross_snapshot >= 0 and deduction_snapshot >= 0 and net_snapshot >= 0")
@Getter @Setter @NoArgsConstructor
public class PayRunEmployee extends Auditable {
 @Id @UuidGenerator private UUID id;
 @ManyToOne(fetch=FetchType.LAZY,optional=false)@JoinColumn(name="pay_run_id",nullable=false,updatable=false)private PayRun payRun;
 @ManyToOne(fetch=FetchType.LAZY,optional=false)@JoinColumn(name="payroll_employee_id",nullable=false,updatable=false)private PayrollEmployee payrollEmployee;
 @Column(name="employee_code",nullable=false,updatable=false,length=64)private String employeeCode;
 @OneToOne(fetch=FetchType.LAZY)@JoinColumn(name="calculation_id")private Calculation calculation;
 @Column(name="gross_snapshot",nullable=false,precision=19,scale=4)private BigDecimal grossSnapshot;
 @Column(name="deduction_snapshot",nullable=false,precision=19,scale=4)private BigDecimal deductionSnapshot;
 @Column(name="net_snapshot",nullable=false,precision=19,scale=4)private BigDecimal netSnapshot;
 @Column(name="currency_snapshot",nullable=false,length=3)private String currency;
}
