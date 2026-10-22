package com.lexorion.finance.domain;

/** What posted a ledger entry: an issued invoice, a receipt, or the reversal of a voided invoice. */
public enum VoucherType { INVOICE, RECEIPT, INVOICE_VOID }
