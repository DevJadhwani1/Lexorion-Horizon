package com.lexorion.finance.service;

import static com.lexorion.finance.api.BillingDtos.*;

import com.lexorion.finance.domain.ClientStatus;
import com.lexorion.finance.domain.Invoice;
import com.lexorion.finance.domain.InvoiceStatus;
import com.lexorion.finance.repository.AllocationRepository;
import com.lexorion.finance.repository.BillingClientRepository;
import com.lexorion.finance.repository.InvoiceRepository;
import com.lexorion.finance.repository.PaymentRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Receivables overview for the Finance workspace, grouped by currency because invoices are never converted. */
@Service
public class BillingSummaryService {
    private final FinanceWorkspaceScope scope;
    private final InvoiceRepository invoices;
    private final PaymentRepository payments;
    private final AllocationRepository allocations;
    private final BillingClientRepository clients;
    private final Clock clock;

    public BillingSummaryService(FinanceWorkspaceScope scope, InvoiceRepository invoices, PaymentRepository payments,
            AllocationRepository allocations, BillingClientRepository clients, Clock clock) {
        this.scope = scope;
        this.invoices = invoices;
        this.payments = payments;
        this.allocations = allocations;
        this.clients = clients;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public BillingSummary summary() {
        UUID workspaceId = scope.context().workspaceId();
        LocalDate today = LocalDate.now(clock), monthStart = today.withDayOfMonth(1), monthEnd = today.withDayOfMonth(today.lengthOfMonth());
        Map<String, Totals> totals = new TreeMap<>();
        long overdueCount = 0;
        List<Invoice> open = invoices.findByWorkspaceIdAndStatusIn(workspaceId, EnumSet.of(InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID));
        for (Invoice invoice : open) {
            Totals t = totals.computeIfAbsent(invoice.getCurrency(), c -> new Totals());
            BigDecimal balance = invoice.balanceDue();
            t.outstanding = t.outstanding.add(balance);
            long late = ChronoUnit.DAYS.between(invoice.getDueDate(), today);
            if (late > 0) {
                overdueCount++;
                t.overdue = t.overdue.add(balance);
            }
            int bucket = late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
            t.aging[bucket] = t.aging[bucket].add(balance);
        }
        for (Object[] row : invoices.invoicedBetween(workspaceId, monthStart, monthEnd))
            totals.computeIfAbsent((String) row[0], c -> new Totals()).invoiced = (BigDecimal) row[1];
        for (Object[] row : allocations.allocatedBetween(workspaceId, monthStart, monthEnd))
            totals.computeIfAbsent((String) row[0], c -> new Totals()).collected = (BigDecimal) row[1];
        for (Object[] row : payments.receivedBetween(workspaceId, monthStart, monthEnd)) {
            Totals t = totals.computeIfAbsent((String) row[0], c -> new Totals());
            t.received = (BigDecimal) row[1];
        }
        List<CurrencyTotals> byCurrency = totals.entrySet().stream().map(e -> {
            Totals t = e.getValue();
            return new CurrencyTotals(e.getKey(), t.outstanding, t.overdue, t.invoiced, t.collected, t.received.subtract(t.collected),
                    new Aging(t.aging[0], t.aging[1], t.aging[2], t.aging[3], t.aging[4]));
        }).toList();
        return new BillingSummary(today, invoices.countByStatus(workspaceId, InvoiceStatus.DRAFT), open.size(), overdueCount,
                invoices.countByStatus(workspaceId, InvoiceStatus.PAID),
                clients.countByWorkspaceIdAndStatus(workspaceId, ClientStatus.ACTIVE), byCurrency);
    }

    private static final class Totals {
        BigDecimal outstanding = BigDecimal.ZERO, overdue = BigDecimal.ZERO, invoiced = BigDecimal.ZERO, collected = BigDecimal.ZERO,
                received = BigDecimal.ZERO;
        final BigDecimal[] aging = {BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO};
    }
}
