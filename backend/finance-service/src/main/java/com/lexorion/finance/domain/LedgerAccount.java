package com.lexorion.finance.domain;

/** The billing chart of accounts. Receivables, bank and cash are assets; sales is income; output taxes are liabilities. */
public enum LedgerAccount {
    RECEIVABLES("Accounts receivable"),
    SALES("Sales"),
    OUTPUT_CGST("Output CGST"),
    OUTPUT_SGST("Output SGST"),
    OUTPUT_IGST("Output IGST"),
    OUTPUT_TAX("Output tax"),
    BANK("Bank"),
    CASH("Cash");

    private final String displayName;

    LedgerAccount(String displayName) { this.displayName = displayName; }

    public String displayName() { return displayName; }
}
