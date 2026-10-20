package com.lexorion.payroll.service;

import com.lexorion.payroll.entitlement.PayrollProcessingEntitlementGate;
import com.lexorion.payroll.repository.PayrollEmployeeRepository;
import com.lexorion.payroll.repository.CompensationProfileRepository;
import java.util.HashSet;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Configuration inventory only. Period eligibility remains authoritative in CalculationService. */
@Service
public class PayrollReadinessService {
    public record Readiness(int activeEmployees, int employeesWithCompensation, String nextEmployeeCode) {}
    private final PayrollWorkspaceScope scope;
    private final PayrollEmployeeRepository employees;
    private final CompensationProfileRepository profiles;
    private final PayrollProcessingEntitlementGate entitlement;
    public PayrollReadinessService(PayrollWorkspaceScope scope, PayrollEmployeeRepository employees,
            CompensationProfileRepository profiles, PayrollProcessingEntitlementGate entitlement) {
        this.scope = scope; this.employees = employees; this.profiles = profiles; this.entitlement = entitlement;
    }
    @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public Readiness get() {
        var context = scope.context();
        entitlement.requireProcessing(context);
        var active = employees.findActiveCodes(context.workspaceId());
        var configured = new HashSet<>(profiles.findConfiguredEmployeeCodes(context.workspaceId()));
        return new Readiness(active.size(), (int) active.stream().filter(configured::contains).count(),
                active.stream().filter(code -> !configured.contains(code)).findFirst().orElse(null));
    }
}
