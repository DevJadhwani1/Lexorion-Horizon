package com.lexorion.payroll.service;

import com.lexorion.payroll.api.PayrollException;
import com.lexorion.payroll.domain.*;
import com.lexorion.payroll.repository.*;
import java.math.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class PayRunTransactions {
    private static final BigDecimal ZERO = new BigDecimal("0.0000");
    private static final Duration ABANDONED_AFTER = Duration.ofMinutes(5);
    private final PayrollWorkspaceScope scope;
    private final PayRunService service;
    private final PayRunRepository runs;
    private final PayRunEmployeeRepository employees;
    private final CalculationService calculations;
    private final PayrollLedgerEntryRepository ledger;
    private final PayRunEligibility eligibility;
    public PayRunTransactions(PayrollWorkspaceScope scope, PayRunService service, PayRunRepository runs,
            PayRunEmployeeRepository employees, CalculationService calculations, PayrollLedgerEntryRepository ledger, PayRunEligibility eligibility) {
        this.scope = scope; this.service = service; this.runs = runs; this.employees = employees; this.calculations = calculations; this.ledger = ledger; this.eligibility = eligibility;
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public UUID begin(String key) {
        scope.locked();
        PayRun run = service.locked(key);
        PayRunService.requireStatus(run, PayRunStatus.DRAFT);
        if (employees.countByPayRunId(run.getId()) == 0) throw new PayrollException(409, "Empty Pay Run cannot be processed");
        UUID attempt = UUID.randomUUID();
        run.setStatus(PayRunStatus.PROCESSING); run.setProcessingAttempt(attempt);
        run.setProcessingStartedAt(Instant.now()); run.setFailureMessage(null);
        runs.saveAndFlush(run);
        return attempt;
    }
    // Acquire the workspace lock before reading current committed overlaps. A repeatable-read
    // snapshot established while waiting for the lock could miss a concurrent completed run.
    @Transactional(propagation = Propagation.REQUIRES_NEW, isolation = Isolation.READ_COMMITTED)
    public PayRun complete(String key, UUID attempt) {
        scope.locked();
        PayRun run = service.locked(key);
        PayRunService.requireStatus(run, PayRunStatus.PROCESSING);
        if (!attempt.equals(run.getProcessingAttempt())) throw new PayrollException(409, "Processing attempt has been superseded");
        List<PayRunEmployee> included = employees.findByPayRunIdOrderByEmployeeCodeAsc(run.getId());
        BigDecimal gross = ZERO, deductions = ZERO, net = ZERO, employer = ZERO;
        for (PayRunEmployee item : included) {
            Calculation calculation = calculations.persist(eligibility.evaluate(run, item.getPayrollEmployee()));
            item.setCalculation(calculation); item.setGrossSnapshot(calculation.getGrossAmount());
            item.setDeductionSnapshot(calculation.getDeductionAmount()); item.setNetSnapshot(calculation.getNetAmount());
            item.setEmployerContributionSnapshot(calculation.getEmployerContributionAmount());
            item.setCurrency(calculation.getCurrency()); employees.save(item);
            gross = gross.add(calculation.getGrossAmount()); deductions = deductions.add(calculation.getDeductionAmount()); net = net.add(calculation.getNetAmount());
            employer = employer.add(calculation.getEmployerContributionAmount());
        }
        gross = PayRunEligibility.money(gross); deductions = PayRunEligibility.money(deductions); net = PayRunEligibility.money(net);
        if (net.compareTo(gross.subtract(deductions)) != 0) throw new PayrollException(409, "Pay Run totals are inconsistent");
        run.setGrossTotal(gross); run.setDeductionTotal(deductions); run.setNetTotal(net);
        run.setEmployerContributionTotal(PayRunEligibility.money(employer));
        run.setStatus(PayRunStatus.CALCULATED); run.setProcessingAttempt(null); run.setProcessingStartedAt(null);
        return runs.saveAndFlush(run);
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(String key, UUID attempt, String message) {
        scope.locked(); PayRun run = service.locked(key);
        if (run.getStatus() == PayRunStatus.PROCESSING && attempt.equals(run.getProcessingAttempt())) {
            run.setStatus(PayRunStatus.FAILED); run.setFailureMessage(message);
            run.setProcessingAttempt(null); run.setProcessingStartedAt(null); runs.saveAndFlush(run);
        }
    }
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recover(String key) {
        scope.locked(); PayRun run = service.locked(key);
        if (run.getStatus() == PayRunStatus.PROCESSING) {
            Instant started = run.getProcessingStartedAt() == null ? run.getUpdatedAt() : run.getProcessingStartedAt();
            if (started == null || started.plus(ABANDONED_AFTER).isAfter(Instant.now()))
                throw new PayrollException(409, "Processing is still active. Refresh first; an abandoned attempt can be recovered after five minutes");
        } else if (run.getStatus() != PayRunStatus.FAILED && run.getStatus() != PayRunStatus.CALCULATED) {
            throw new PayrollException(409, "Only failed, calculated or abandoned processing runs can return to draft");
        }
        if (run.getFinalizedAt() != null || ledger.existsByWorkspaceIdAndPayRunId(run.getWorkspace().getId(), run.getId()))
            throw new PayrollException(409, "A run with finalized history cannot return to draft");
        var included = employees.findByPayRunIdOrderByEmployeeCodeAsc(run.getId());
        if (run.getStatus() == PayRunStatus.CALCULATED) {
            // Keep old calculation objects immutable and visible in history; a later process creates new snapshots.
            for (PayRunEmployee employee : included) {
                employee.setCalculation(null); employee.setGrossSnapshot(ZERO);
                employee.setDeductionSnapshot(ZERO); employee.setNetSnapshot(ZERO); employee.setEmployerContributionSnapshot(ZERO); employees.save(employee);
            }
        } else if (included.stream().anyMatch(e -> e.getCalculation() != null)) {
            throw new PayrollException(409, "Failed run has unexpected committed snapshots and requires operator review");
        }
        run.setGrossTotal(ZERO); run.setDeductionTotal(ZERO); run.setNetTotal(ZERO); run.setEmployerContributionTotal(ZERO);
        run.setStatus(PayRunStatus.DRAFT); run.setProcessingAttempt(null); run.setProcessingStartedAt(null);
        run.setFailureMessage(null); runs.saveAndFlush(run);
    }
}
