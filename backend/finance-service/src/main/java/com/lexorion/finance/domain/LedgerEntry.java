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
import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.UuidGenerator;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** One side of a double-entry posting. Immutable: corrections are new reversing entries. */
@Entity
@Immutable
@EntityListeners(AuditingEntityListener.class)
@Table(name = "finance_ledger_entries",
        uniqueConstraints = @UniqueConstraint(name = "uk_finance_ledger_posting", columnNames = {"workspace_id", "voucher_type", "source_id", "account"}),
        indexes = {
                @Index(name = "idx_finance_ledger_workspace_date", columnList = "workspace_id,entry_date"),
                @Index(name = "idx_finance_ledger_client_date", columnList = "client_id,entry_date")})
@Getter
@Setter
@NoArgsConstructor
public class LedgerEntry {
    @Id
    @UuidGenerator
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false, updatable = false)
    private FinanceWorkspace workspace;

    @Column(name = "entry_date", nullable = false, updatable = false)
    private LocalDate entryDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "voucher_type", nullable = false, updatable = false, length = 16)
    private VoucherType voucherType;

    @Column(name = "voucher_number", nullable = false, updatable = false, length = 32)
    private String voucherNumber;

    /** The invoice (INVOICE, INVOICE_VOID) or payment (RECEIPT) that posted this entry. */
    @Column(name = "source_id", nullable = false, updatable = false)
    private UUID sourceId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invoice_id", nullable = false, updatable = false)
    private Invoice invoice;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "client_id", nullable = false, updatable = false)
    private BillingClient client;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 24)
    private LedgerAccount account;

    @Column(nullable = false, updatable = false, precision = 19, scale = 2)
    private BigDecimal debit = BigDecimal.ZERO;

    @Column(nullable = false, updatable = false, precision = 19, scale = 2)
    private BigDecimal credit = BigDecimal.ZERO;

    @Column(nullable = false, updatable = false, length = 3)
    private String currency;

    @Column(nullable = false, updatable = false, length = 300)
    private String narration;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** Debit minus credit: positive increases an asset such as receivables. */
    public BigDecimal net() {
        return debit.subtract(credit);
    }
}
