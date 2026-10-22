package com.lexorion.finance.service;

import static com.lexorion.finance.api.BillingDtos.*;

import com.lexorion.finance.api.FinanceException;
import com.lexorion.finance.api.TemplateConfig;
import com.lexorion.finance.api.TemplateDtos.RenderTemplate;
import com.lexorion.finance.domain.BillingClient;
import com.lexorion.finance.domain.ClientStatus;
import com.lexorion.finance.domain.FinanceWorkspace;
import com.lexorion.finance.domain.Invoice;
import com.lexorion.finance.domain.InvoiceLine;
import com.lexorion.finance.domain.InvoiceStatus;
import com.lexorion.finance.domain.InvoiceTemplate;
import com.lexorion.finance.domain.Payment;
import com.lexorion.finance.repository.InvoiceRepository;
import com.lexorion.finance.repository.PaymentRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Invoice lifecycle: DRAFT (editable) → ISSUED → PARTIALLY_PAID → PAID, or VOID from DRAFT or an unpaid ISSUED invoice.
 * Every invoice has a stable REF- reference; a draft has no number yet. Issuing assigns the template's sequential
 * number and freezes the template and buyer details onto the invoice, so later edits never change a bill that was
 * sent. All numbering runs under the workspace lock, so issued numbers are gap-free.
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
    private final InvoiceTemplateService templates;
    private final InvoiceNumbering numbering;
    private final JsonMapper json;
    private final Clock clock;

    public InvoiceService(FinanceWorkspaceScope scope, BillingClientService clients, InvoiceRepository invoices,
            PaymentRepository payments, InvoiceTemplateService templates, InvoiceNumbering numbering, JsonMapper json, Clock clock) {
        this.scope = scope;
        this.clients = clients;
        this.invoices = invoices;
        this.payments = payments;
        this.templates = templates;
        this.numbering = numbering;
        this.json = json;
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
                PageRequest.of(page, size, Sort.by(order, property).and(Sort.by(Sort.Direction.DESC, "reference"))));
        return new PageResponse<>(result.getContent().stream().map(i -> InvoiceSummary.from(i, today)).toList(),
                page, size, result.getTotalElements(), result.getTotalPages(), sort, order.name().toLowerCase(Locale.ROOT));
    }

    @Transactional(readOnly = true)
    public InvoiceResponse get(String reference) {
        return response(find(reference));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public InvoiceResponse create(InvoiceRequest request) {
        FinanceWorkspace workspace = scope.locked();
        Invoice invoice = new Invoice();
        invoice.setWorkspace(workspace);
        String reference;
        do {
            reference = String.format(Locale.ROOT, "REF-%05d", workspace.getNextDraftNumber());
            workspace.setNextDraftNumber(workspace.getNextDraftNumber() + 1);
        } while (invoices.existsByWorkspaceIdAndReference(workspace.getId(), reference));
        invoice.setReference(reference);
        invoice.setStatus(InvoiceStatus.DRAFT);
        apply(invoice, request, true);
        return response(invoices.saveAndFlush(invoice));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public InvoiceResponse update(String reference, InvoiceRequest request) {
        Invoice invoice = locked(reference);
        if (invoice.getStatus() != InvoiceStatus.DRAFT) throw new FinanceException(409, "Only draft invoices can be edited");
        // Remove old lines first so renumbered lines do not collide with the unique line-number constraint.
        invoice.getLines().clear();
        invoices.saveAndFlush(invoice);
        apply(invoice, request, false);
        return response(invoices.saveAndFlush(invoice));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public InvoiceResponse issue(String reference) {
        // Workspace before invoice: the same lock order as every other numbered write.
        FinanceWorkspace workspace = scope.locked();
        Invoice invoice = locked(reference);
        if (invoice.getStatus() != InvoiceStatus.DRAFT) throw new FinanceException(409, "Only draft invoices can be issued");
        if (invoice.getTotal().signum() <= 0) throw new FinanceException(409, "An invoice must have a total above zero to be issued");
        if (invoice.getClient().getStatus() != ClientStatus.ACTIVE) throw new FinanceException(409, "The client is archived");
        RenderTemplate template = templates.render(invoice.getTemplate());
        Map<String, String> values = customFields(invoice);
        for (TemplateConfig.CustomField field : template.config().customFields())
            if (Boolean.TRUE.equals(field.required()) && (values.get(field.key()) == null || values.get(field.key()).isBlank()))
                throw new FinanceException(409, field.label() + " is required by the " + template.name() + " template");
        if (invoice.awaitingNumber()) invoice.setInvoiceNumber(numbering.next(workspace, template.config().numbering(), invoice.getIssueDate()));
        invoice.setTemplateSnapshot(json.writeValueAsString(new DocumentSnapshot(template, BillTo.from(invoice.getClient()))));
        invoice.setStatus(InvoiceStatus.ISSUED);
        invoice.setIssuedAt(Instant.now(clock));
        return response(invoices.saveAndFlush(invoice));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public InvoiceResponse voidInvoice(String reference, VoidInvoice request) {
        Invoice invoice = locked(reference);
        if (invoice.getStatus() != InvoiceStatus.DRAFT && invoice.getStatus() != InvoiceStatus.ISSUED)
            throw new FinanceException(409, "Only draft or unpaid issued invoices can be voided");
        if (invoice.getAmountPaid().signum() != 0 || payments.existsByInvoiceId(invoice.getId()))
            throw new FinanceException(409, "Invoices with recorded payments cannot be voided");
        invoice.setStatus(InvoiceStatus.VOID);
        invoice.setVoidedAt(Instant.now(clock));
        invoice.setVoidReason(request.reason().trim());
        return response(invoices.saveAndFlush(invoice));
    }

    @Transactional(readOnly = true)
    public List<PaymentResponse> payments(String reference) {
        return payments.findByInvoiceIdOrderByPaymentDateAscReceiptNumberAsc(find(reference).getId()).stream()
                .map(PaymentResponse::from).toList();
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public PaymentResponse recordPayment(String reference, RecordPayment request) {
        // Workspace before invoice: the same lock order as every other numbered write.
        FinanceWorkspace workspace = scope.locked();
        Invoice invoice = locked(reference);
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

    private void apply(Invoice invoice, InvoiceRequest request, boolean creating) {
        BillingClient client = clients.find(request.clientKey());
        if (client.getStatus() != ClientStatus.ACTIVE) throw new FinanceException(409, "The client is archived");
        InvoiceTemplate template = templates.forInvoice(invoice.getWorkspace().getId(), request.templateKey());
        TemplateConfig config = templates.render(template).config();
        invoice.setTemplate(template);
        invoice.setCustomFields(writeCustomFields(config, request.customFields()));
        invoice.setPlaceOfSupply(blankToNull(request.placeOfSupply()) != null ? request.placeOfSupply().trim() : client.getRegion());
        LocalDate issueDate = request.issueDate() == null ? today() : request.issueDate();
        LocalDate dueDate = request.dueDate() == null ? issueDate.plusDays(client.getPaymentTermsDays()) : request.dueDate();
        if (dueDate.isBefore(issueDate)) throw new FinanceException(400, "Due date cannot be before the invoice date");
        invoice.setClient(client);
        invoice.setCurrency(client.getCurrency());
        invoice.setIssueDate(issueDate);
        invoice.setDueDate(dueDate);
        invoice.setNotes(request.notes() == null && creating ? config.defaultNotes() : blankToNull(request.notes()));
        BigDecimal subtotal = BigDecimal.ZERO, tax = BigDecimal.ZERO;
        int number = 1;
        for (InvoiceLineRequest item : request.lines()) {
            BigDecimal rate = item.taxRate() == null ? BigDecimal.ZERO : item.taxRate();
            BigDecimal lineSubtotal = item.quantity().multiply(item.unitPrice()).setScale(2, RoundingMode.HALF_UP);
            BigDecimal lineTax = lineSubtotal.multiply(rate).divide(HUNDRED, 2, RoundingMode.HALF_UP);
            InvoiceLine line = new InvoiceLine();
            line.setInvoice(invoice);
            line.setLineNumber(number++);
            line.setItemCode(blankToNull(item.itemCode()));
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

    /** Only the template's fields are kept. Dates and numbers must parse; required fields are checked at issue. */
    private String writeCustomFields(TemplateConfig config, Map<String, String> submitted) {
        Map<String, String> values = new LinkedHashMap<>();
        Map<String, String> input = submitted == null ? Map.of() : submitted;
        for (String key : input.keySet())
            if (config.customFields().stream().noneMatch(field -> field.key().equals(key)))
                throw new FinanceException(400, "Unknown invoice field: " + key);
        for (TemplateConfig.CustomField field : config.customFields()) {
            String value = blankToNull(input.get(field.key()));
            if (value == null) continue;
            try {
                if (field.type() == TemplateConfig.FieldType.DATE) LocalDate.parse(value);
                if (field.type() == TemplateConfig.FieldType.NUMBER) new BigDecimal(value);
            } catch (RuntimeException invalid) {
                throw new FinanceException(400, field.label() + " must be a valid " + field.type().name().toLowerCase(Locale.ROOT));
            }
            values.put(field.key(), value);
        }
        return values.isEmpty() ? null : json.writeValueAsString(values);
    }

    private Map<String, String> customFields(Invoice invoice) {
        if (invoice.getCustomFields() == null) return Map.of();
        return json.readValue(invoice.getCustomFields(), new TypeReference<LinkedHashMap<String, String>>() { });
    }

    private InvoiceResponse response(Invoice invoice) {
        DocumentSnapshot document = invoice.getTemplateSnapshot() != null ? thaw(invoice.getTemplateSnapshot())
                : new DocumentSnapshot(templates.render(invoice.getTemplate()), BillTo.from(invoice.getClient()));
        return InvoiceResponse.from(invoice, today(), document, customFields(invoice), taxBreakdown(invoice, document.template().config()));
    }

    private DocumentSnapshot thaw(String snapshot) {
        DocumentSnapshot frozen = json.readValue(snapshot, DocumentSnapshot.class);
        RenderTemplate t = frozen.template();
        return new DocumentSnapshot(new RenderTemplate(t.templateKey(), t.name(), t.layout(), t.config().normalized()), frozen.billTo());
    }

    /**
     * GST: within the seller's state the tax is shown as equal CGST and SGST halves; otherwise, or when either state is
     * unknown, as IGST. Other modes show a single line with the template's label.
     */
    static List<TaxLine> taxBreakdown(Invoice invoice, TemplateConfig config) {
        BigDecimal tax = invoice.getTaxTotal();
        if (tax.signum() == 0) return List.of();
        if (config.tax().mode() != TemplateConfig.TaxMode.GST) return List.of(new TaxLine(config.tax().label(), tax));
        String seller = config.seller().region(), supply = invoice.getPlaceOfSupply();
        if (seller != null && supply != null && seller.trim().equalsIgnoreCase(supply.trim())) {
            BigDecimal central = tax.divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
            return List.of(new TaxLine("CGST", central), new TaxLine("SGST", tax.subtract(central)));
        }
        return List.of(new TaxLine("IGST", tax));
    }

    private Invoice find(String reference) {
        return invoices.findByWorkspaceIdAndReference(scope.context().workspaceId(), number(reference))
                .orElseThrow(() -> new FinanceException(404, "Invoice not found"));
    }

    private Invoice locked(String reference) {
        return invoices.findScopedForUpdate(scope.context().workspaceId(), number(reference))
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
