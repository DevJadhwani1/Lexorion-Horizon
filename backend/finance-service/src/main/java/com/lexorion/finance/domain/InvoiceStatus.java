package com.lexorion.finance.domain;

/** DRAFT is editable. ISSUED, PARTIALLY_PAID and PAID follow received payments. VOID is terminal. */
public enum InvoiceStatus { DRAFT, ISSUED, PARTIALLY_PAID, PAID, VOID }
