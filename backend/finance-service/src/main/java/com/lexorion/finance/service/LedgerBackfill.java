package com.lexorion.finance.service;

import com.lexorion.finance.api.BillingDtos.DocumentSnapshot;
import com.lexorion.finance.api.TemplateConfig;
import com.lexorion.finance.domain.Allocation;
import com.lexorion.finance.domain.Invoice;
import com.lexorion.finance.domain.Payment;
import com.lexorion.finance.repository.AllocationRepository;
import com.lexorion.finance.repository.InvoiceRepository;
import com.lexorion.finance.repository.PaymentRepository;
import java.time.Clock;
import java.time.LocalDate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * Posts invoices and payments that existed before the ledger. Runs at startup and is idempotent: anything already
 * posted is skipped, so it only ever fills gaps. Invoices post on their invoice date, receipts on their payment date
 * and voids of issued invoices on the day they were voided.
 */
@Component
public class LedgerBackfill implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(LedgerBackfill.class);
    private final InvoiceRepository invoices;
    private final PaymentRepository payments;
    private final AllocationRepository allocations;
    private final LedgerService ledger;
    private final JsonMapper json;
    private final Clock clock;

    public LedgerBackfill(InvoiceRepository invoices, PaymentRepository payments, AllocationRepository allocations, LedgerService ledger, JsonMapper json, Clock clock) {
        this.invoices = invoices;
        this.payments = payments;
        this.allocations = allocations;
        this.ledger = ledger;
        this.json = json;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        int posted = 0;
        for (Invoice invoice : invoices.findByIssuedAtIsNotNull()) {
            TemplateConfig config = invoice.getTemplateSnapshot() == null ? TemplateConfig.standard()
                    : json.readValue(invoice.getTemplateSnapshot(), DocumentSnapshot.class).template().config().normalized();
            ledger.postInvoice(invoice, InvoiceService.taxBreakdown(invoice, config), invoice.getIssueDate());
            if (invoice.getVoidedAt() != null) ledger.postVoid(invoice, LocalDate.ofInstant(invoice.getVoidedAt(), clock.getZone()));
            posted++;
        }
        for (Payment payment : payments.findAll()) {
            if (payment.getInvoice() != null && allocations.findByReceiptIdAndReversedAtIsNull(payment.getId()).isEmpty()) ledger.postReceipt(payment);
            for (Allocation allocation : allocations.findByReceiptIdAndReversedAtIsNull(payment.getId())) ledger.postAllocation(allocation);
        }
        if (posted > 0) log.info("Ledger checked for {} issued invoices", posted);
    }
}
