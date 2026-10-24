package com.lexorion.workforce.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "employment_spells", uniqueConstraints = {
    @UniqueConstraint(name = "uk_employment_spell_number", columnNames = {"employee_id", "spell_number"}),
    @UniqueConstraint(name = "uk_employment_spell_open", columnNames = {"open_employee_id"})
}, indexes = @Index(name = "idx_employment_spell_employee", columnList = "workspace_id,employee_id,spell_number"))
@Getter
@Setter
@NoArgsConstructor
public class EmploymentSpell {
    @Id
    @UuidGenerator
    private UUID id;
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false, updatable = false)
    private WorkforceWorkspace workspace;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id", nullable = false, updatable = false)
    private Employee employee;
    @Column(name = "spell_number", nullable = false, updatable = false)
    private int spellNumber;
    @Enumerated(EnumType.STRING)
    @Column(name = "employment_status", nullable = false, length = 20)
    private EmploymentStatus status;
    @Enumerated(EnumType.STRING)
    @Column(name = "employment_type", length = 20)
    private EmploymentType employmentType;
    @Column(name = "joining_date", nullable = false)
    private LocalDate joiningDate;
    @Column(name = "exit_date")
    private LocalDate exitDate;
    @Column(name = "exit_reason", length = 500)
    private String exitReason;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id")
    private Department department;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "designation_id")
    private Designation designation;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reporting_manager_id")
    private Employee reportingManager;
    /** Set to the employee id while this spell is open. Null when the spell is closed. Unique, so two open spells cannot exist. */
    @Column(name = "open_employee_id")
    private UUID openEmployeeId;

    public EmploymentSpell(WorkforceWorkspace workspace, Employee employee, int spellNumber, EmploymentStatus status, EmploymentType employmentType, LocalDate joiningDate) {
        this.workspace = workspace;
        this.employee = employee;
        this.spellNumber = spellNumber;
        this.status = status;
        this.employmentType = employmentType;
        this.joiningDate = joiningDate;
        this.createdAt = Instant.now();
        this.openEmployeeId = open(status) ? employee.getId() : null;
    }

    public static boolean open(EmploymentStatus status) {
        return status == EmploymentStatus.ACTIVE || status == EmploymentStatus.ON_LEAVE || status == EmploymentStatus.SUSPENDED;
    }

    public void projectFrom(Employee employee) {
        status = employee.getStatus();
        employmentType = employee.getEmploymentType();
        joiningDate = employee.getJoiningDate();
        department = employee.getDepartment();
        designation = employee.getDesignation();
        reportingManager = employee.getReportingManager();
        exitDate = null;
        exitReason = null;
        openEmployeeId = open(status) ? employee.getId() : null;
    }

    public void close(EmploymentStatus status, LocalDate exitDate, String exitReason) {
        this.status = status;
        this.exitDate = exitDate;
        this.exitReason = exitReason;
        this.openEmployeeId = null;
    }
}
