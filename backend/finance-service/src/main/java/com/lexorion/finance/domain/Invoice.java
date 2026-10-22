package com.lexorion.finance.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "finance_invoices",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_finance_invoice_workspace_number", columnNames = {"workspace_id", "invoice_number"}),
                @UniqueConstraint(name = "uk_finance_invoice_workspace_reference", columnNames = {"workspace_id", "reference"})},
        indexes = {
                @Index(name = "idx_finance_invoice_workspace_status", columnList = "workspace_id,status"),
                @Index(name = "idx_finance_invoice_client", columnList = "client_id")})
@Getter
@Setter
@NoArgsConstructor
public class Invoice extends Auditable {
    @Id
    @UuidGenerator
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false, updatable = false)
    private FinanceWorkspace workspace;

    /** Stable, URL-safe identifier, for example {@code REF-00001}. Never changes. */
    @Column(nullable = false, updatable = false, length = 32)
    private String reference;

    /** The template's sequential number, for example {@code OH/26-27/0001}. Assigned when the invoice is issued. */
    @Column(name = "invoice_number", length = 32)
    private String invoiceNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "client_id", nullable = false)
    private BillingClient client;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private InvoiceStatus status = InvoiceStatus.DRAFT;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(name = "issue_date", nullable = false)
    private LocalDate issueDate;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Column(length = 2000)
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id")
    private InvoiceTemplate template;

    /** Template frozen at issue: {@code {"templateKey","name","layout","config"}} as JSON. */
    @Column(name = "template_snapshot", columnDefinition = "text")
    private String templateSnapshot;

    /** Values for the template's industry fields, keyed by field key, as JSON. */
    @Column(name = "custom_fields", columnDefinition = "text")
    private String customFields;

    @Column(name = "place_of_supply", length = 64)
    private String placeOfSupply;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "tax_total", nullable = false, precision = 19, scale = 2)
    private BigDecimal taxTotal = BigDecimal.ZERO;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    @Column(name = "amount_paid", nullable = false, precision = 19, scale = 2)
    private BigDecimal amountPaid = BigDecimal.ZERO;

    @Column(name = "issued_at")
    private Instant issuedAt;

    @Column(name = "voided_at")
    private Instant voidedAt;

    @Column(name = "void_reason", length = 300)
    private String voidReason;

    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("lineNumber ASC")
    private List<InvoiceLine> lines = new ArrayList<>();

    public boolean awaitingNumber() {
        return invoiceNumber == null;
    }

    public BigDecimal balanceDue() {
        return total.subtract(amountPaid);
    }
}
