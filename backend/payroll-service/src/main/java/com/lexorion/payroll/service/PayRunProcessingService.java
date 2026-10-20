package com.lexorion.payroll.service;

import com.lexorion.payroll.api.PayRunDtos.PayRunResponse;
import com.lexorion.payroll.api.PayrollException;
import com.lexorion.payroll.entitlement.PayrollProcessingEntitlementGate;
import org.springframework.stereotype.Service;

@Service
public class PayRunProcessingService {
    private final PayrollWorkspaceScope scope;
    private final PayrollProcessingEntitlementGate entitlement;
    private final PayRunTransactions transactions;
    private final PayRunService runs;
    private final io.micrometer.core.instrument.MeterRegistry metrics;
    public PayRunProcessingService(PayrollWorkspaceScope scope, PayrollProcessingEntitlementGate entitlement,
            PayRunTransactions transactions, PayRunService runs, io.micrometer.core.instrument.MeterRegistry metrics) {
        this.scope=scope; this.entitlement=entitlement; this.transactions=transactions; this.runs=runs; this.metrics=metrics;
    }
    public PayRunResponse process(String key) {
        entitlement.requireProcessing(scope.context());
        var attempt = transactions.begin(key);
        try {
            transactions.complete(key, attempt);
            return runs.get(key);
        } catch (RuntimeException failure) {
            metrics.counter("lexorion.payroll.processing.failures").increment();
            String message = failure instanceof PayrollException ? failure.getMessage() : "Processing failed. Correct configuration or service availability, recover to draft, and retry.";
            if (message.length() > 255) message = message.substring(0, 255);
            try { transactions.fail(key, attempt, message); }
            catch (RuntimeException markingFailure) { failure.addSuppressed(markingFailure); }
            throw failure;
        }
    }
    public PayRunResponse recover(String key) {
        entitlement.requireProcessing(scope.context()); transactions.recover(key); return runs.get(key);
    }
}
