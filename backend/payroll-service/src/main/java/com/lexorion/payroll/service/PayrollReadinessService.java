package com.lexorion.payroll.service;

import com.lexorion.payroll.api.PayrollSetupDtos.SectionStatus;
import com.lexorion.payroll.domain.PayrollEmployee;
import com.lexorion.payroll.domain.PayrollStatus;
import com.lexorion.payroll.domain.StatutoryProfile;
import com.lexorion.payroll.entitlement.PayrollProcessingEntitlementGate;
import com.lexorion.payroll.repository.CompensationProfileRepository;
import com.lexorion.payroll.repository.PayrollEmployeeRepository;
import com.lexorion.payroll.repository.StatutoryProfileRepository;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Configuration inventory only. Period eligibility remains authoritative in CalculationService. */
@Service
public class PayrollReadinessService {
    /**
     * statutoryDecisionsOpen counts active employees whose EPF, ESI, professional tax, or labour welfare fund
     * applicability is still unresolved. detailsAwaitingVerification counts saved details that an administrator
     * has not marked verified. Neither count changes pay-run eligibility.
     */
    public record Readiness(int activeEmployees, int employeesWithCompensation, String nextEmployeeCode, int statutoryDecisionsOpen, int detailsAwaitingVerification) {}
    private static final Set<String> APPLICABILITY = Set.of("epf", "esi", "pt", "lwf");
    private final PayrollWorkspaceScope scope;
    private final PayrollEmployeeRepository employees;
    private final CompensationProfileRepository profiles;
    private final StatutoryProfileRepository statutory;
    private final PayrollProcessingEntitlementGate entitlement;
    public PayrollReadinessService(PayrollWorkspaceScope scope, PayrollEmployeeRepository employees,
            CompensationProfileRepository profiles, StatutoryProfileRepository statutory, PayrollProcessingEntitlementGate entitlement) {
        this.scope = scope; this.employees = employees; this.profiles = profiles; this.statutory = statutory; this.entitlement = entitlement;
    }
    @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public Readiness get() {
        var context = scope.context();
        entitlement.requireProcessing(context);
        var active = employees.findByWorkspaceIdOrderByEmployeeCodeAsc(context.workspaceId()).stream()
                .filter(employee -> employee.getStatus() == PayrollStatus.ACTIVE).toList();
        var configured = new HashSet<>(profiles.findConfiguredEmployeeCodes(context.workspaceId()));
        Map<String, StatutoryProfile> byCode = statutory.findForWorkspace(context.workspaceId()).stream()
                .collect(Collectors.toMap(profile -> profile.getPayrollEmployee().getEmployeeCode(), Function.identity(), (left, right) -> left));
        int undecided = 0, verification = 0;
        for (PayrollEmployee employee : active) {
            var sections = PayrollSetupService.sectionsFor(employee, byCode.get(employee.getEmployeeCode()), configured.contains(employee.getEmployeeCode()));
            if (sections.stream().anyMatch(section -> APPLICABILITY.contains(section.key()) && section.status() == SectionStatus.NOT_STARTED)) undecided++;
            if (sections.stream().anyMatch(section -> section.status() == SectionStatus.PENDING_VERIFICATION)) verification++;
        }
        var codes = active.stream().map(PayrollEmployee::getEmployeeCode).toList();
        return new Readiness(codes.size(), (int) codes.stream().filter(configured::contains).count(),
                codes.stream().filter(code -> !configured.contains(code)).findFirst().orElse(null), undecided, verification);
    }
}
