package com.lexorion.finance.api;

import com.lexorion.finance.domain.LedgerAccount;
import com.lexorion.finance.domain.VoucherType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Books: settings, financial years and the reports read from the ledger. Amounts are per currency; nothing is converted. */
public final class LedgerDtos {
    private LedgerDtos() { }

    public record BookSettings(int fiscalYearStartMonth, LocalDate booksLockedUntil, String currentFiscalYear) { }

    public record UpdateBookSettings(@NotNull @Min(1) @Max(12) Integer fiscalYearStartMonth, LocalDate booksLockedUntil) { }

    public record FiscalYearOption(String label, LocalDate start, LocalDate end, boolean current) { }

    /** One month of the financial year. Invoiced is the receivable raised net of voids; receivables are at month end. */
    public record MonthRow(String month, LocalDate start, LocalDate end, int invoicesIssued, int invoicesVoided, BigDecimal taxable,
            BigDecimal cgst, BigDecimal sgst, BigDecimal igst, BigDecimal otherTax, BigDecimal invoiced, BigDecimal collected,
            BigDecimal closingReceivables) { }

    public record CurrencySummary(String currency, BigDecimal openingReceivables, List<MonthRow> months, MonthRow total,
            BigDecimal closingReceivables) { }

    public record YearSummary(String fiscalYear, LocalDate start, LocalDate end, LocalDate booksLockedUntil, List<CurrencySummary> currencies) { }

    /** One invoice (or its reversal) in the sales register. Reversals carry negative amounts. */
    public record SalesRegisterRow(LocalDate date, VoucherType voucherType, String invoiceNumber, String reference, String clientKey,
            String clientName, String clientTaxId, String placeOfSupply, String currency, BigDecimal taxable, BigDecimal cgst,
            BigDecimal sgst, BigDecimal igst, BigDecimal otherTax, BigDecimal total) { }

    public record RegisterTotal(String currency, int invoices, BigDecimal taxable, BigDecimal cgst, BigDecimal sgst, BigDecimal igst,
            BigDecimal otherTax, BigDecimal total) { }

    public record SalesRegister(String fiscalYear, String month, List<SalesRegisterRow> rows, List<RegisterTotal> totals) { }

    public record JournalLine(LocalDate date, VoucherType voucherType, String voucherNumber, String invoiceReference, String clientKey,
            String clientName, LedgerAccount account, String accountName, String currency, BigDecimal debit, BigDecimal credit, String narration) { }

    public record CurrencyTotal(String currency, BigDecimal debit, BigDecimal credit) { }

    public record Journal(String fiscalYear, String month, List<JournalLine> content, int page, int size, long totalElements, int totalPages,
            List<CurrencyTotal> totals) { }

    public record StatementLine(LocalDate date, VoucherType voucherType, String voucherNumber, String invoiceReference, String narration,
            BigDecimal debit, BigDecimal credit, BigDecimal balance) { }

    public record CurrencyStatement(String currency, BigDecimal openingBalance, List<StatementLine> lines, BigDecimal totalDebit,
            BigDecimal totalCredit, BigDecimal closingBalance) { }

    public record Statement(String fiscalYear, LocalDate start, LocalDate end, String clientKey, String clientName, List<CurrencyStatement> currencies) { }
}
