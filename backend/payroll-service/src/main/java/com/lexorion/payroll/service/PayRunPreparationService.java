package com.lexorion.payroll.service;

import static com.lexorion.payroll.api.PayRunPreparationDtos.*;
import com.lexorion.payroll.api.PayrollException;
import com.lexorion.payroll.domain.*;
import com.lexorion.payroll.entitlement.PayrollProcessingEntitlementGate;
import com.lexorion.payroll.repository.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** Preparation is derived from Draft membership and current rules, never a durable eligibility promise. */
@Service
public class PayRunPreparationService {
    private final PayrollWorkspaceScope scope;
    private final PayRunRepository runs;
    private final PayrollEmployeeRepository employees;
    private final PayRunEmployeeRepository included;
    private final PayRunEligibility eligibility;
    private final PayrollProcessingEntitlementGate entitlement;
    public PayRunPreparationService(PayrollWorkspaceScope scope, PayRunRepository runs,
            PayrollEmployeeRepository employees, PayRunEmployeeRepository included,
            PayRunEligibility eligibility, PayrollProcessingEntitlementGate entitlement) {
        this.scope = scope; this.runs = runs; this.employees = employees; this.included = included;
        this.eligibility = eligibility; this.entitlement = entitlement;
    }
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Preparation get(String key) {
        entitlement.requireProcessing(scope.context());
        return report(find(key), null);
    }
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Preparation save(String key, Selection request) {
        entitlement.requireProcessing(scope.context());
        scope.locked();
        PayRun run = runs.findScopedForUpdate(scope.context().workspaceId(), PayRunService.key(key))
                .orElseThrow(() -> new PayrollException(404, "Pay Run not found"));
        PayRunService.requireStatus(run, PayRunStatus.DRAFT);
        Set<String> selected = new LinkedHashSet<>();
        for (String raw : request.employeeCodes()) {
            if (!selected.add(CompensationService.employeeCode(raw)))
                throw new PayrollException(409, "Duplicate employee in selection");
        }
        var candidates = employees.findByWorkspaceIdOrderByEmployeeCodeAsc(scope.context().workspaceId());
        if (!candidates.stream().map(PayrollEmployee::getEmployeeCode).toList().containsAll(selected))
            throw new PayrollException(404, "Selected payroll employee not found in this workspace");
        Preparation checked = report(run, selected);
        if (checked.selectedBlockedCount() > 0) {
            Employee blocked = checked.employees().stream().filter(e -> e.selected() && !e.eligible()).findFirst().orElseThrow();
            throw new PayrollException(409, blocked.employeeCode() + ": " + blocked.blockedReason());
        }
        if (!checked.issues().isEmpty()) throw new PayrollException(409, checked.issues().getFirst());
        var current = included.findByPayRunIdOrderByEmployeeCodeAsc(run.getId());
        for (PayRunEmployee item : current) if (!selected.contains(item.getEmployeeCode())) included.delete(item);
        Set<String> existing = new HashSet<>();
        current.forEach(item -> existing.add(item.getEmployeeCode()));
        for (PayrollEmployee employee : candidates) if (selected.contains(employee.getEmployeeCode()) && !existing.contains(employee.getEmployeeCode())) {
            PayRunEmployee item = new PayRunEmployee(); item.setPayRun(run); item.setPayrollEmployee(employee);
            item.setEmployeeCode(employee.getEmployeeCode()); item.setCurrency(run.getCurrency());
            item.setGrossSnapshot(BigDecimal.ZERO); item.setDeductionSnapshot(BigDecimal.ZERO); item.setNetSnapshot(BigDecimal.ZERO);
            included.save(item);
        }
        included.flush();
        return checked;
    }
    private PayRun find(String key) {
        return runs.findByWorkspaceIdAndPayRunKey(scope.context().workspaceId(), PayRunService.key(key))
                .orElseThrow(() -> new PayrollException(404, "Pay Run not found"));
    }
    private Preparation report(PayRun run, Set<String> replacement) {
        Set<String> selected = replacement == null ? new HashSet<>(included.findByPayRunIdOrderByEmployeeCodeAsc(run.getId())
                .stream().map(PayRunEmployee::getEmployeeCode).toList()) : replacement;
        List<String> issues = new ArrayList<>();
        if (run.getStatus() != PayRunStatus.DRAFT) issues.add("Only a Draft pay run can be prepared. Refresh the run to see its current state.");
        try { eligibility.validatePeriod(run); } catch (PayrollException ex) { issues.add(ex.getMessage()); }
        List<Employee> result = new ArrayList<>();
        BigDecimal gross = BigDecimal.ZERO, deductions = BigDecimal.ZERO, net = BigDecimal.ZERO;
        for (PayrollEmployee employee : employees.findByWorkspaceIdOrderByEmployeeCodeAsc(scope.context().workspaceId())) {
            String reason = null;
            try {
                Calculation preview = eligibility.evaluate(run, employee);
                if (selected.contains(employee.getEmployeeCode())) {
                    gross = gross.add(preview.getGrossAmount()); deductions = deductions.add(preview.getDeductionAmount()); net = net.add(preview.getNetAmount());
                }
            } catch (PayrollException ex) { reason = ex.getMessage(); }
            result.add(new Employee(employee.getEmployeeCode(), selected.contains(employee.getEmployeeCode()), reason == null, reason));
        }
        try { PayRunEligibility.money(gross); PayRunEligibility.money(deductions); PayRunEligibility.money(net); }
        catch (PayrollException ex) { issues.add(ex.getMessage()); }
        long eligible = result.stream().filter(Employee::eligible).count();
        long selectedBlocked = result.stream().filter(e -> e.selected() && !e.eligible()).count();
        return new Preparation(run.getPayRunKey(), run.getStatus(), run.getPeriodStart(), run.getPeriodEnd(),
                run.getCalculationDate(), run.getCurrency(), result.size(), eligible, result.size() - eligible,
                selected.size(), selectedBlocked, !selected.isEmpty() && selectedBlocked == 0 && issues.isEmpty(),
                issues, result);
    }
}
