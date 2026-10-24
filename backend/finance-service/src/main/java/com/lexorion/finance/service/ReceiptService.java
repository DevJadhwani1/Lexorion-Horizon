package com.lexorion.finance.service;

import static com.lexorion.finance.api.BillingDtos.PaymentResponse;
import static com.lexorion.finance.api.BillingDtos.RecordPayment;

import com.lexorion.finance.api.FinanceException;
import com.lexorion.finance.api.ReceiptDtos.AllocateReceipt;
import com.lexorion.finance.api.ReceiptDtos.CreateReceipt;
import com.lexorion.finance.domain.Allocation;
import com.lexorion.finance.domain.BillingClient;
import com.lexorion.finance.domain.ClientStatus;
import com.lexorion.finance.domain.FinanceWorkspace;
import com.lexorion.finance.domain.Invoice;
import com.lexorion.finance.domain.InvoiceStatus;
import com.lexorion.finance.domain.Payment;
import com.lexorion.finance.repository.AllocationRepository;
import com.lexorion.finance.repository.BillingClientRepository;
import com.lexorion.finance.repository.InvoiceRepository;
import com.lexorion.finance.repository.PaymentRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Receipts are recorded for a client. An allocation applies part of a receipt to one invoice and is the only thing
 * that reduces that invoice's balance. Reversing an allocation posts a new ledger entry; nothing is deleted.
 */
@Service
public class ReceiptService {
    private static final String RECEIPT = "RECEIPT";
    private static final String ALLOCATE = "ALLOCATE";
    private static final String REVERSE = "REVERSE_ALLOCATION";
    private final FinanceWorkspaceScope scope;
    private final PaymentRepository payments;
    private final AllocationRepository allocations;
    private final InvoiceRepository invoices;
    private final BillingClientRepository clients;
    private final LedgerService ledger;
    private final Idempotency idempotency;
    private final Clock clock;

    public ReceiptService(FinanceWorkspaceScope scope, PaymentRepository payments, AllocationRepository allocations,
            InvoiceRepository invoices, BillingClientRepository clients, LedgerService ledger, Idempotency idempotency, Clock clock) {
        this.scope = scope;
        this.payments = payments;
        this.allocations = allocations;
        this.invoices = invoices;
        this.clients = clients;
        this.ledger = ledger;
        this.idempotency = idempotency;
        this.clock = clock;
    }

    /** The invoice shortcut: the whole receipt is allocated to that invoice. */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PaymentResponse receiveAgainstInvoice(String reference, RecordPayment request, String idempotencyKey) {
        String key = Idempotency.normalize(idempotencyKey);
        FinanceWorkspace workspace = scope.locked();
        var prior = idempotency.find(workspace.getId(), RECEIPT, key);
        if (prior.isPresent()) return receiptResponse(loadReceipt(workspace.getId(), prior.get()));
        Invoice invoice = lockedInvoice(workspace.getId(), reference);
        if (invoice.getStatus() != InvoiceStatus.ISSUED && invoice.getStatus() != InvoiceStatus.PARTIALLY_PAID)
            throw new FinanceException(409, "Payments can only be recorded against issued, unpaid invoices");
        BigDecimal amount = money(request.amount());
        if (amount.compareTo(invoice.balanceDue()) > 0) throw new FinanceException(400, "Payment exceeds the balance due");
        requireReceiptDate(workspace, request.paymentDate(), invoice.getIssueDate());
        Payment receipt = newReceipt(workspace, invoice.getClient(), request.paymentDate(), request.method(), amount, invoice.getCurrency(),
                request.reference(), request.notes());
        receipt.setInvoice(invoice);
        payments.saveAndFlush(receipt);
        Allocation allocation = allocate(workspace, receipt, invoice, amount);
        refresh(invoice);
        ledger.postAllocation(allocation);
        idempotency.remember(workspace, RECEIPT, key, receipt.getId());
        return PaymentResponse.of(receipt, invoice, amount, amount, allocation.getId());
    }

    /** A receipt that is not yet applied to any invoice. It does not change invoice balances. */
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PaymentResponse create(CreateReceipt request, String idempotencyKey) {
        String key = Idempotency.normalize(idempotencyKey);
        FinanceWorkspace workspace = scope.locked();
        var prior = idempotency.find(workspace.getId(), RECEIPT, key);
        if (prior.isPresent()) return receiptResponse(loadReceipt(workspace.getId(), prior.get()));
        BillingClient client = clients.findByWorkspaceIdAndClientKey(workspace.getId(), request.clientKey().trim())
                .orElseThrow(() -> new FinanceException(404, "Client not found"));
        if (client.getStatus() != ClientStatus.ACTIVE) throw new FinanceException(409, "The client is archived");
        BigDecimal amount = money(request.amount());
        requireReceiptDate(workspace, request.paymentDate(), null);
        Payment receipt = newReceipt(workspace, client, request.paymentDate(), request.method(), amount, client.getCurrency(),
                request.reference(), request.notes());
        payments.saveAndFlush(receipt);
        idempotency.remember(workspace, RECEIPT, key, receipt.getId());
        return PaymentResponse.of(receipt, null, amount, BigDecimal.ZERO, null);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PaymentResponse allocate(String receiptNumber, AllocateReceipt request, String idempotencyKey) {
        String key = Idempotency.normalize(idempotencyKey);
        FinanceWorkspace workspace = scope.locked();
        var prior = idempotency.find(workspace.getId(), ALLOCATE, key);
        if (prior.isPresent()) return allocationResponse(loadAllocation(workspace.getId(), prior.get()));
        Payment receipt = lockedReceipt(workspace.getId(), receiptNumber);
        Invoice invoice = lockedInvoice(workspace.getId(), request.invoiceReference());
        if (!invoice.getClient().getId().equals(receipt.getClient().getId()))
            throw new FinanceException(409, "A receipt can only be allocated to invoices for the same client");
        if (!invoice.getCurrency().equals(receipt.getCurrency()))
            throw new FinanceException(409, "A receipt can only be allocated to invoices in the same currency");
        if (invoice.getStatus() != InvoiceStatus.ISSUED && invoice.getStatus() != InvoiceStatus.PARTIALLY_PAID)
            throw new FinanceException(409, "Only issued, unpaid invoices can receive an allocation");
        BigDecimal amount = money(request.amount());
        BigDecimal unallocated = receipt.getAmount().subtract(allocations.activeTotal(receipt.getId()));
        if (amount.compareTo(unallocated) > 0) throw new FinanceException(400, "Allocation exceeds the unallocated amount on the receipt");
        if (amount.compareTo(invoice.balanceDue()) > 0) throw new FinanceException(400, "Allocation exceeds the balance due");
        if (receipt.getPaymentDate().isBefore(invoice.getIssueDate()))
            throw new FinanceException(400, "Payment date cannot be before the invoice date");
        LedgerService.requireOpen(workspace, receipt.getPaymentDate(), "The payment date");
        Allocation allocation = allocate(workspace, receipt, invoice, amount);
        refresh(invoice);
        ledger.postAllocation(allocation);
        idempotency.remember(workspace, ALLOCATE, key, allocation.getId());
        return PaymentResponse.of(receipt, invoice, amount, allocations.activeTotal(receipt.getId()), allocation.getId());
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PaymentResponse reverse(String receiptNumber, UUID allocationId, String idempotencyKey) {
        String key = Idempotency.normalize(idempotencyKey);
        FinanceWorkspace workspace = scope.locked();
        var prior = idempotency.find(workspace.getId(), REVERSE, key);
        if (prior.isPresent()) return allocationResponse(loadAllocation(workspace.getId(), prior.get()));
        Allocation allocation = loadAllocation(workspace.getId(), allocationId);
        if (!allocation.getReceipt().getReceiptNumber().equals(number(receiptNumber)))
            throw new FinanceException(404, "Allocation not found");
        if (!allocation.active()) throw new FinanceException(409, "This allocation has already been reversed");
        LocalDate today = LocalDate.now(clock);
        LedgerService.requireOpen(workspace, today, "A reversal");
        allocation.setReversedAt(Instant.now(clock));
        allocations.saveAndFlush(allocation);
        refresh(allocation.getInvoice());
        ledger.postReversal(allocation, today);
        idempotency.remember(workspace, REVERSE, key, allocation.getId());
        return allocationResponse(allocation);
    }

    private Allocation allocate(FinanceWorkspace workspace, Payment receipt, Invoice invoice, BigDecimal amount) {
        Allocation allocation = new Allocation();
        allocation.setWorkspace(workspace);
        allocation.setReceipt(receipt);
        allocation.setInvoice(invoice);
        allocation.setAmount(amount);
        return allocations.saveAndFlush(allocation);
    }

    private void refresh(Invoice invoice) {
        BigDecimal paid = allocations.activeOnInvoice(invoice.getId());
        invoice.setAmountPaid(paid);
        if (invoice.getStatus() != InvoiceStatus.DRAFT && invoice.getStatus() != InvoiceStatus.VOID) {
            int compared = paid.compareTo(invoice.getTotal());
            invoice.setStatus(compared == 0 ? InvoiceStatus.PAID : paid.signum() == 0 ? InvoiceStatus.ISSUED : InvoiceStatus.PARTIALLY_PAID);
        }
        invoices.save(invoice);
    }

    private Payment newReceipt(FinanceWorkspace workspace, BillingClient client, LocalDate date,
            com.lexorion.finance.domain.PaymentMethod method, BigDecimal amount, String currency, String reference, String notes) {
        Payment receipt = new Payment();
        receipt.setWorkspace(workspace);
        receipt.setClient(client);
        receipt.setReceiptNumber(String.format(Locale.ROOT, "RCPT-%05d", workspace.getNextReceiptNumber()));
        workspace.setNextReceiptNumber(workspace.getNextReceiptNumber() + 1);
        receipt.setAmount(amount);
        receipt.setCurrency(currency);
        receipt.setPaymentDate(date);
        receipt.setMethod(method);
        receipt.setReference(blank(reference));
        receipt.setNotes(blank(notes));
        return receipt;
    }

    private void requireReceiptDate(FinanceWorkspace workspace, LocalDate date, LocalDate earliest) {
        if (date.isAfter(LocalDate.now(clock))) throw new FinanceException(400, "Payment date cannot be in the future");
        if (earliest != null && date.isBefore(earliest)) throw new FinanceException(400, "Payment date cannot be before the invoice date");
        LedgerService.requireOpen(workspace, date, "The payment date");
    }

    private PaymentResponse receiptResponse(Payment receipt) {
        BigDecimal allocated = allocations.activeTotal(receipt.getId());
        var active = allocations.findByReceiptIdAndReversedAtIsNull(receipt.getId());
        Invoice shown = active.size() == 1 ? active.get(0).getInvoice() : receipt.getInvoice();
        return PaymentResponse.of(receipt, shown, receipt.getAmount(), allocated, null);
    }

    private PaymentResponse allocationResponse(Allocation allocation) {
        Payment receipt = allocation.getReceipt();
        return PaymentResponse.of(receipt, allocation.getInvoice(), allocation.getAmount(), allocations.activeTotal(receipt.getId()), allocation.getId());
    }

    private Payment loadReceipt(UUID workspaceId, UUID id) {
        Payment receipt = payments.findById(id).orElseThrow(() -> new FinanceException(404, "Receipt not found"));
        if (!receipt.getWorkspace().getId().equals(workspaceId)) throw new FinanceException(404, "Receipt not found");
        return receipt;
    }

    private Payment lockedReceipt(UUID workspaceId, String receiptNumber) {
        return payments.findByWorkspaceIdAndReceiptNumber(workspaceId, number(receiptNumber))
                .orElseThrow(() -> new FinanceException(404, "Receipt not found"));
    }

    private Allocation loadAllocation(UUID workspaceId, UUID id) {
        Allocation allocation = allocations.findById(id).orElseThrow(() -> new FinanceException(404, "Allocation not found"));
        if (!allocation.getWorkspace().getId().equals(workspaceId)) throw new FinanceException(404, "Allocation not found");
        return allocation;
    }

    private Invoice lockedInvoice(UUID workspaceId, String reference) {
        return invoices.findScopedForUpdate(workspaceId, number(reference))
                .orElseThrow(() -> new FinanceException(404, "Invoice not found"));
    }

    private static BigDecimal money(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.UNNECESSARY);
    }

    private static String number(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
