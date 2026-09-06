package com.lexorion.payroll.domain;
import jakarta.persistence.*;import java.time.LocalDate;import java.util.*;import lombok.*;import org.hibernate.annotations.Check;import org.hibernate.annotations.UuidGenerator;
@Entity @Check(constraints="effective_to is null or effective_to >= effective_from")
@Table(name="payroll_salary_templates",uniqueConstraints=@UniqueConstraint(name="uk_salary_template_workspace_key",columnNames={"workspace_id","template_key"}),indexes={@Index(name="idx_salary_template_workspace_status",columnList="workspace_id,template_status"),@Index(name="idx_salary_template_workspace_dates",columnList="workspace_id,effective_from,effective_to")})
@Getter@Setter@NoArgsConstructor public class SalaryTemplate extends Auditable{
 @Id@UuidGenerator private UUID id;@ManyToOne(fetch=FetchType.LAZY,optional=false)@JoinColumn(name="workspace_id",nullable=false,updatable=false)private PayrollWorkspace workspace;
 @Column(name="template_key",nullable=false,updatable=false,length=64)private String templateKey;@Column(name="display_name",nullable=false,length=150)private String displayName;@Column(length=500)private String description;
 @Column(nullable=false,length=3)private String currency;@Enumerated(EnumType.STRING)@Column(name="pay_frequency",nullable=false,length=16)private PayFrequency payFrequency;
 @Enumerated(EnumType.STRING)@Column(name="template_status",nullable=false,length=16)private SalaryTemplateStatus status;@Column(name="effective_from",nullable=false)private LocalDate effectiveFrom;@Column(name="effective_to")private LocalDate effectiveTo;
 @OneToMany(mappedBy="template",cascade=CascadeType.ALL,orphanRemoval=true)@OrderBy("id ASC")private List<SalaryTemplateComponent>components=new ArrayList<>();
}
