package com.lexorion.finance.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Local mirror of a Platform workspace. Its id is the Platform workspace id; it also owns the draft and receipt sequences. */
@Entity
@Table(name = "finance_workspaces")
@Getter
@Setter
@NoArgsConstructor
public class FinanceWorkspace extends Auditable {
    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "workspace_key", nullable = false, updatable = false, length = 63)
    private String key;

    @Column(name = "next_invoice_number", nullable = false)
    private long nextInvoiceNumber = 1;

    @Column(name = "next_receipt_number", nullable = false)
    private long nextReceiptNumber = 1;

    /** Sequence for invoice references (REF-00001). The template's number is assigned when the invoice is issued. */
    @Column(name = "next_draft_number", nullable = false)
    private long nextDraftNumber = 1;
}
