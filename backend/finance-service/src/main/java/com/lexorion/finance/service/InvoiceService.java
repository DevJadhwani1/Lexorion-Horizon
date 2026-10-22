package com.lexorion.finance.service;

import static com.lexorion.finance.api.BillingDtos.*;

import com.lexorion.finance.api.FinanceException;
import com.lexorion.finance.domain.BillingClient;
import com.lexorion.finance.domain.ClientStatus;
import com.lexorion.finance.domain.FinanceWorkspace;
import com.lexorion.finance.domain.Invoice;
import com.lexorion.finance.domain.InvoiceLine;
import com.lexorion.finance.domain.InvoiceStatus;
import com.lexorion.finance.domain.Payment;
import com.lexorion.finance.repository.InvoiceRepository;
import com.lexorion.finance.repository.PaymentRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Invoice lifecycle: DRAFT (editable) → ISSUED → PARTIALLY_PAID → PAID, or VOID from DRAFT or an unpaid ISSUED invoice.
 * Invoice and receipt numbers come from per-workspace sequences under the workspace lock, so they are gap-free.
 */
@Service
public class InvoiceService {
    private static final Map<String, String> SORTS = Map.of("createdAt", "createdAt", "issueDate", "issueDate",
            "dueDate", "dueDate", "invoiceNumber", "invoiceNumber", "total", "total", "updatedAt", "updatedAt");
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private final FinanceWorkspaceScope scope;
    private final BillingClientService clients;
    private final InvoiceRepository invoices;
    private final PaymentRepository payments;
    private final Clock clock;

    public InvoiceService(FinanceWorkspaceScope scope, BillingClientService clients, InvoiceRepository invoices,
            PaymentRepository payments, Clock clock) {
        this.scope = scope;
        this.clients = clients;
        this.invoices = invoices;
        this.payments = payments;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PageResponse<InvoiceSummary> list(int page, int size, String sort, String direction, InvoiceStatus status,
            String clientKey, boolean overdueOnly) {
        if (page < 0 || size < 1 || size > 100) throw new FinanceException(400, "Page must be zero or more and size between 1 and 100");
        String property = SORTS.get(sort);
        if (property == null) throw new FinanceException(400, "Unsupported sort");
        Sort.Direction order = "asc".equalsIgnoreCase(direction) ? Sort.Direction.ASC : Sort.Direction.DESC;
        LocalDate today = today();
        Page<Invoice> result = invoices.search(scope.context().workspaceId(), status,
                clientKey == null || clientKey.isBlank() ? null : clientKey.trim(), overdueOnly, today,
                PageRequest.of(page, size, Sort.by(order, property).and(Sort.by(Sort.Direction.DESC, "invoiceNumber"))));
        return new PageResponse<>(result.getContent().stream().map(i -> InvoiceSummary.from(i, today)).toList(),
                page, size, result.getTotalElements(), result.getTotalPages(), sort, order.name().toLowerCase(Locale.ROOT));
    }

    @Transactional(readOnly = true)
    public InvoiceResponse get(String invoiceNumber) {
        return InvoiceResponse.from(find(invoiceNumber), today());
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public InvoiceResponse create(InvoiceRequest request) {
        FinanceWorkspace workspace = scope.locked();
        Invoice invoice = new Invoice();
        invoice.setWorkspace(workspace);
        invoice.setInvoiceNumber(String.format(Locale.ROOT, "INV-%05d", workspace.getNextInvoiceNumber()));
        workspace.setNextInvoiceNumber(workspace.getNextInvoiceNumber() + 1);
        invoice.setStatus(InvoiceStatus.DRAFT);
        apply(invoice, request);
        return InvoiceResponse.from(invoices.saveAndFlush(invoice), today());
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public InvoiceResponse update(String invoiceNumber, InvoiceRequest request) {
        Invoice invoice = locked(invoiceNumber);
        if (invoice.getStatus() != InvoiceStatus.DRAFT) throw new FinanceException(409, "Only draft invoices can be edited");
        // Remove old lines first so renumbered lines do not collide with the unique line-number constraint.
        invoice.getLines().clear();
        invoices.saveAndFlush(invoice);
        apply(invoice, request);
        return InvoiceResponse.from(invoices.saveAndFlush(invoice), today());
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public InvoiceResponse issue(String invoiceNumber) {
        Invoice invoice = locked(invoiceNumber);
        if (invoice.getStatus() != InvoiceStatus.DRAFT) throw new FinanceException(409, "Only draft invoices can be issued");
        if (invoice.getTotal().signum() <= 0) throw new FinanceException(409, "An invoice must have a total above zero to be issued");
        if (invoice.getClient().getStatus() != ClientStatus.ACTIVE) throw new FinanceException(409, "The client is archived");
        invoice.setStatus(InvoiceStatus.ISSUED);
        invoice.setIssuedAt(Instant.now(clock));
        return InvoiceResponse.from(invoices.saveAndFlush(invoice), today());
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public InvoiceResponse voidInvoice(String invoiceNumber, VoidInvoice request) {
        Invoice invoice = locked(invoiceNumber);
        if (invoice.getStatus() != InvoiceStatus.DRAFT && invoice.getStatus() != InvoiceStatus.ISSUED)
            throw new FinanceException(409, "Only draft or unpaid issued invoices can be voided");
        if (invoice.getAmountPaid().signum() != 0 || payments.existsByInvoiceId(invoice.getId()))
            throw new FinanceException(409, "Invoices with recorded payments cannot be voided");
        invoice.setStatus(InvoiceStatus.VOID);
        invoice.setVoidedAt(Instant.now(clock));
        invoice.setVoidReason(request.reason().trim());
        return InvoiceResponse.from(invoices.saveAndFlush(invoice), today());
    }

    @Transactional(readOnly = true)
    public List<PaymentResponse> payments(String invoiceNumber) {
        return payments.findByInvoiceIdOrderByPaymentDateAscReceiptNumberAsc(find(invoiceNumber).getId()).stream()
                .map(PaymentResponse::from).toList();
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PaymentResponse recordPayment(String invoiceNumber, RecordPayment request) {
        // Workspace before invoice: the same lock order as every other numbered write.
        FinanceWorkspace workspace = scope.locked();
        Invoice invoice = locked(invoiceNumber);
        if (invoice.getStatus() != InvoiceStatus.ISSUED && invoice.getStatus() != InvoiceStatus.PARTIALLY_PAID)
            throw new FinanceException(409, "Payments can only be recorded against issued, unpaid invoices");
        BigDecimal amount = request.amount().setScale(2, RoundingMode.UNNECESSARY);
        if (amount.compareTo(invoice.balanceDue()) > 0) throw new FinanceException(400, "Payment exceeds the balance due");
        if (request.paymentDate().isAfter(today())) throw new FinanceException(400, "Payment date cannot be in the future");
        if (request.paymentDate().isBefore(invoice.getIssueDate())) throw new FinanceException(400, "Payment date cannot be before the invoice date");
        Payment payment = new Payment();
        payment.setWorkspace(workspace);
        payment.setInvoice(invoice);
        payment.setReceiptNumber(String.format(Locale.ROOT, "RCPT-%05d", workspace.getNextReceiptNumber()));
        workspace.setNextReceiptNumber(workspace.getNextReceiptNumber() + 1);
        payment.setAmount(amount);
        payment.setCurrency(invoice.getCurrency());
        payment.setPaymentDate(request.paymentDate());
        payment.setMethod(request.method());
        payment.setReference(blankToNull(request.reference()));
        payment.setNotes(blankToNull(request.notes()));
        invoice.setAmountPaid(invoice.getAmountPaid().add(amount));
        invoice.setStatus(invoice.balanceDue().signum() == 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID);
        invoices.save(invoice);
        return PaymentResponse.from(payments.saveAndFlush(payment));
    }

    private void apply(Invoice invoice, InvoiceRequest request) {
        BillingClient client = clients.find(request.clientKey());
        if (client.getStatus() != ClientStatus.ACTIVE) throw new FinanceException(409, "The client is archived");
        LocalDate issueDate = request.issueDate() == null ? today() : request.issueDate();
        LocalDate dueDate = request.dueDate() == null ? issueDate.plusDays(client.getPaymentTermsDays()) : request.dueDate();
        if (dueDate.isBefore(issueDate)) throw new FinanceException(400, "Due date cannot be before the invoice date");
        invoice.setClient(client);
        invoice.setCurrency(client.getCurrency());
        invoice.setIssueDate(issueDate);
        invoice.setDueDate(dueDate);
        invoice.setNotes(blankToNull(request.notes()));
        BigDecimal subtotal = BigDecimal.ZERO, tax = BigDecimal.ZERO;
        int number = 1;
        for (InvoiceLineRequest item : request.lines()) {
            BigDecimal rate = item.taxRate() == null ? BigDecimal.ZERO : item.taxRate();
            BigDecimal lineSubtotal = item.quantity().multiply(item.unitPrice()).setScale(2, RoundingMode.HALF_UP);
            BigDecimal lineTax = lineSubtotal.multiply(rate).divide(HUNDRED, 2, RoundingMode.HALF_UP);
            InvoiceLine line = new InvoiceLine();
            line.setInvoice(invoice);
            line.setLineNumber(number++);
            line.setDescription(item.description().trim());
            line.setQuantity(item.quantity());
            line.setUnitPrice(item.unitPrice());
            line.setTaxRate(rate);
            line.setSubtotal(lineSubtotal);
            line.setTaxAmount(lineTax);
            line.setTotal(lineSubtotal.add(lineTax));
            invoice.getLines().add(line);
            subtotal = subtotal.add(lineSubtotal);
            tax = tax.add(lineTax);
        }
        invoice.setSubtotal(subtotal);
        invoice.setTaxTotal(tax);
        invoice.setTotal(subtotal.add(tax));
    }

    private Invoice find(String invoiceNumber) {
        return invoices.findByWorkspaceIdAndInvoiceNumber(scope.context().workspaceId(), number(invoiceNumber))
                .orElseThrow(() -> new FinanceException(404, "Invoice not found"));
    }

    private Invoice locked(String invoiceNumber) {
        return invoices.findScopedForUpdate(scope.context().workspaceId(), number(invoiceNumber))
                .orElseThrow(() -> new FinanceException(404, "Invoice not found"));
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }

    private static String number(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
