package com.lexorion.finance.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** A received payment. Immutable once recorded. */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Table(name = "finance_payments",
        uniqueConstraints = @UniqueConstraint(name = "uk_finance_payment_workspace_receipt", columnNames = {"workspace_id", "receipt_number"}),
        indexes = {
                @Index(name = "idx_finance_payment_invoice", columnList = "invoice_id"),
                @Index(name = "idx_finance_payment_client", columnList = "client_id"),
                @Index(name = "idx_finance_payment_workspace_date", columnList = "workspace_id,payment_date")})
@Getter
@Setter
@NoArgsConstructor
public class Payment {
    @Id
    @UuidGenerator
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false, updatable = false)
    private FinanceWorkspace workspace;

    /** The client the money came from. Allocations, not this field, decide which invoices it settles. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "client_id", nullable = false, updatable = false)
    private BillingClient client;

    /** Set when the receipt was recorded against one invoice. Unallocated receipts leave this empty. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id", updatable = false)
    private Invoice invoice;

    @Column(name = "receipt_number", nullable = false, updatable = false, length = 32)
    private String receiptNumber;

    @Column(nullable = false, updatable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, updatable = false, length = 3)
    private String currency;

    @Column(name = "payment_date", nullable = false, updatable = false)
    private LocalDate paymentDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 16)
    private PaymentMethod method;

    @Column(updatable = false, length = 64)
    private String reference;

    @Column(updatable = false, length = 500)
    private String notes;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
