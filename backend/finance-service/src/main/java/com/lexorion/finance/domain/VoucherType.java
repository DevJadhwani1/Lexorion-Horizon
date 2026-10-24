package com.lexorion.finance.domain;

/** What posted a ledger entry. A reversed allocation posts {@code ALLOCATION_REVERSAL}; the original receipt stays. */
public enum VoucherType { INVOICE, RECEIPT, INVOICE_VOID, ALLOCATION_REVERSAL }
