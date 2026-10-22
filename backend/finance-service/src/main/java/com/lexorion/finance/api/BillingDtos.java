package com.lexorion.finance.api;

import com.lexorion.finance.domain.BillingClient;
import com.lexorion.finance.domain.ClientStatus;
import com.lexorion.finance.domain.Invoice;
import com.lexorion.finance.domain.InvoiceLine;
import com.lexorion.finance.domain.InvoiceStatus;
import com.lexorion.finance.domain.Payment;
import com.lexorion.finance.domain.PaymentMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Public Finance billing contracts. Internal UUIDs are never exposed; clients, invoices and payments use their keys and numbers. */
public final class BillingDtos {
    private BillingDtos() { }

    private static final String KEY = "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$";
    private static final String CURRENCY = "^[A-Za-z]{3}$";

    public record CreateClient(
            @Pattern(regexp = KEY, message = "must use lowercase letters, numbers and hyphens") String clientKey,
            @NotBlank @Size(max = 160) String displayName,
            @Email @Size(max = 254) String email,
            @Size(max = 32) String phone,
            @Size(max = 500) String billingAddress,
            @Size(max = 32) String taxId,
            @NotBlank @Pattern(regexp = CURRENCY, message = "must be a three-letter ISO code") String currency,
            @Min(0) @Max(365) Integer paymentTermsDays) { }

    public record UpdateClient(
            @Size(min = 1, max = 160) String displayName,
            @Email @Size(max = 254) String email,
            @Size(max = 32) String phone,
            @Size(max = 500) String billingAddress,
            @Size(max = 32) String taxId,
            @Pattern(regexp = CURRENCY, message = "must be a three-letter ISO code") String currency,
            @Min(0) @Max(365) Integer paymentTermsDays,
            ClientStatus status) { }

    public record ClientResponse(String clientKey, String displayName, String email, String phone, String billingAddress,
            String taxId, String currency, int paymentTermsDays, ClientStatus status, BigDecimal outstandingAmount,
            long openInvoices, Instant createdAt, Instant updatedAt) {
        public static ClientResponse from(BillingClient c, BigDecimal outstanding, long open) {
            return new ClientResponse(c.getClientKey(), c.getDisplayName(), c.getEmail(), c.getPhone(), c.getBillingAddress(),
                    c.getTaxId(), c.getCurrency(), c.getPaymentTermsDays(), c.getStatus(), outstanding, open,
                    c.getCreatedAt(), c.getUpdatedAt());
        }
    }

    public record InvoiceLineRequest(
            @NotBlank @Size(max = 300) String description,
            @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 15, fraction = 4) BigDecimal quantity,
            @NotNull @DecimalMin("0") @Digits(integer = 17, fraction = 2) BigDecimal unitPrice,
            @DecimalMin("0") @DecimalMax("100") @Digits(integer = 3, fraction = 4) BigDecimal taxRate) { }

    /** Creates or replaces a draft. Dates default to today and the client's payment terms. */
    public record InvoiceRequest(
            @NotBlank String clientKey,
            LocalDate issueDate,
            LocalDate dueDate,
            @Size(max = 2000) String notes,
            @NotEmpty @Size(max = 100) List<@Valid @NotNull InvoiceLineRequest> lines) { }

    public record VoidInvoice(@NotBlank @Size(max = 300) String reason) { }

    public record InvoiceLineResponse(int lineNumber, String description, BigDecimal quantity, BigDecimal unitPrice,
            BigDecimal taxRate, BigDecimal subtotal, BigDecimal taxAmount, BigDecimal total) {
        static InvoiceLineResponse from(InvoiceLine l) {
            return new InvoiceLineResponse(l.getLineNumber(), l.getDescription(), l.getQuantity(), l.getUnitPrice(),
                    l.getTaxRate(), l.getSubtotal(), l.getTaxAmount(), l.getTotal());
        }
    }

    public record InvoiceSummary(String invoiceNumber, String clientKey, String clientName, InvoiceStatus status,
            boolean overdue, String currency, LocalDate issueDate, LocalDate dueDate, BigDecimal total,
            BigDecimal amountPaid, BigDecimal balanceDue, Instant updatedAt) {
        public static InvoiceSummary from(Invoice i, LocalDate today) {
            return new InvoiceSummary(i.getInvoiceNumber(), i.getClient().getClientKey(), i.getClient().getDisplayName(),
                    i.getStatus(), isOverdue(i, today), i.getCurrency(), i.getIssueDate(), i.getDueDate(), i.getTotal(),
                    i.getAmountPaid(), i.balanceDue(), i.getUpdatedAt());
        }
    }

    public record InvoiceResponse(String invoiceNumber, String clientKey, String clientName, String clientEmail,
            String clientBillingAddress, String clientTaxId, InvoiceStatus status, boolean overdue, String currency,
            LocalDate issueDate, LocalDate dueDate, String notes, BigDecimal subtotal, BigDecimal taxTotal,
            BigDecimal total, BigDecimal amountPaid, BigDecimal balanceDue, Instant issuedAt, Instant voidedAt,
            String voidReason, List<InvoiceLineResponse> lines, Instant createdAt, Instant updatedAt) {
        public static InvoiceResponse from(Invoice i, LocalDate today) {
            BillingClient c = i.getClient();
            return new InvoiceResponse(i.getInvoiceNumber(), c.getClientKey(), c.getDisplayName(), c.getEmail(),
                    c.getBillingAddress(), c.getTaxId(), i.getStatus(), isOverdue(i, today), i.getCurrency(),
                    i.getIssueDate(), i.getDueDate(), i.getNotes(), i.getSubtotal(), i.getTaxTotal(), i.getTotal(),
                    i.getAmountPaid(), i.balanceDue(), i.getIssuedAt(), i.getVoidedAt(), i.getVoidReason(),
                    i.getLines().stream().map(InvoiceLineResponse::from).toList(), i.getCreatedAt(), i.getUpdatedAt());
        }
    }

    public record RecordPayment(
            @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 17, fraction = 2) BigDecimal amount,
            @NotNull LocalDate paymentDate,
            @NotNull PaymentMethod method,
            @Size(max = 64) String reference,
            @Size(max = 500) String notes) { }

    public record PaymentResponse(String receiptNumber, String invoiceNumber, String clientKey, String clientName,
            BigDecimal amount, String currency, LocalDate paymentDate, PaymentMethod method, String reference,
            String notes, Instant createdAt) {
        public static PaymentResponse from(Payment p) {
            return new PaymentResponse(p.getReceiptNumber(), p.getInvoice().getInvoiceNumber(),
                    p.getInvoice().getClient().getClientKey(), p.getInvoice().getClient().getDisplayName(), p.getAmount(),
                    p.getCurrency(), p.getPaymentDate(), p.getMethod(), p.getReference(), p.getNotes(), p.getCreatedAt());
        }
    }

    public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages,
            String sort, String direction) { }

    public record Aging(BigDecimal current, BigDecimal days1To30, BigDecimal days31To60, BigDecimal days61To90,
            BigDecimal over90) { }

    public record CurrencyTotals(String currency, BigDecimal outstanding, BigDecimal overdue,
            BigDecimal invoicedThisMonth, BigDecimal collectedThisMonth, Aging aging) { }

    public record BillingSummary(LocalDate asOf, long draftInvoices, long openInvoices, long overdueInvoices,
            long paidInvoices, long activeClients, List<CurrencyTotals> totals) { }

    static boolean isOverdue(Invoice i, LocalDate today) {
        return (i.getStatus() == InvoiceStatus.ISSUED || i.getStatus() == InvoiceStatus.PARTIALLY_PAID)
                && i.getDueDate().isBefore(today);
    }
}
