package com.lexorion.finance.service;

import static com.lexorion.finance.api.LedgerDtos.*;

import com.lexorion.finance.api.BillingDtos.DocumentSnapshot;
import com.lexorion.finance.api.BillingDtos.TaxLine;
import com.lexorion.finance.api.FinanceException;
import com.lexorion.finance.domain.BillingClient;
import com.lexorion.finance.domain.FinanceWorkspace;
import com.lexorion.finance.domain.Invoice;
import com.lexorion.finance.domain.LedgerAccount;
import com.lexorion.finance.domain.LedgerEntry;
import com.lexorion.finance.domain.Payment;
import com.lexorion.finance.domain.PaymentMethod;
import com.lexorion.finance.domain.VoucherType;
import com.lexorion.finance.repository.BillingClientRepository;
import com.lexorion.finance.repository.FinanceWorkspaceRepository;
import com.lexorion.finance.repository.LedgerEntryRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Predicate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * The books. Issued invoices, receipts and voids post balanced, immutable double entries; every report (month-wise
 * summary, sales register, journal, client statements) is read from those entries for a financial year.
 *
 *   Invoice issued:  Dr Accounts receivable (total)     Cr Sales (taxable)  Cr Output CGST/SGST/IGST/tax
 *   Receipt:         Dr Bank or Cash (amount)           Cr Accounts receivable
 *   Invoice voided:  the invoice's entries reversed, dated the day it was voided
 */
@Service
public class LedgerService {
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);
    private final LedgerEntryRepository entries;
    private final FinanceWorkspaceScope scope;
    private final FinanceWorkspaceRepository workspaces;
    private final BillingClientRepository clients;
    private final JsonMapper json;
    private final Clock clock;

    public LedgerService(LedgerEntryRepository entries, FinanceWorkspaceScope scope, FinanceWorkspaceRepository workspaces,
            BillingClientRepository clients, JsonMapper json, Clock clock) {
        this.entries = entries;
        this.scope = scope;
        this.workspaces = workspaces;
        this.clients = clients;
        this.json = json;
        this.clock = clock;
    }

    // ---------------------------------------------------------------- posting

    /** Rejects anything dated inside a locked period. */
    public static void requireOpen(FinanceWorkspace workspace, LocalDate date, String what) {
        LocalDate lock = workspace.getBooksLockedUntil();
        if (lock != null && !date.isAfter(lock))
            throw new FinanceException(409, "The books are locked up to " + DAY.format(lock) + ". " + what
                    + " must be dated after that, or an administrator can move the lock date in Books settings.");
    }

    void postInvoice(Invoice invoice, List<TaxLine> taxes, LocalDate date) {
        if (entries.existsByWorkspaceIdAndVoucherTypeAndSourceId(invoice.getWorkspace().getId(), VoucherType.INVOICE, invoice.getId())) return;
        String narration = "Invoice " + invoice.getInvoiceNumber() + " · " + invoice.getClient().getDisplayName();
        Map<LedgerAccount, BigDecimal> credits = new LinkedHashMap<>();
        credits.put(LedgerAccount.SALES, invoice.getSubtotal());
        for (TaxLine tax : taxes) credits.merge(taxAccount(tax.label()), tax.amount(), BigDecimal::add);
        BigDecimal credited = credits.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        if (credited.compareTo(invoice.getTotal()) != 0) throw new IllegalStateException("Invoice " + invoice.getInvoiceNumber() + " does not balance");
        post(invoice, VoucherType.INVOICE, invoice.getId(), invoice.getInvoiceNumber(), date, LedgerAccount.RECEIVABLES, invoice.getTotal(), BigDecimal.ZERO, narration);
        credits.forEach((account, amount) -> post(invoice, VoucherType.INVOICE, invoice.getId(), invoice.getInvoiceNumber(), date, account, BigDecimal.ZERO, amount, narration));
    }

    void postReceipt(Payment payment) {
        Invoice invoice = payment.getInvoice();
        if (entries.existsByWorkspaceIdAndVoucherTypeAndSourceId(invoice.getWorkspace().getId(), VoucherType.RECEIPT, payment.getId())) return;
        String narration = "Receipt " + payment.getReceiptNumber() + " against " + invoice.getInvoiceNumber() + " · " + invoice.getClient().getDisplayName();
        LedgerAccount money = payment.getMethod() == PaymentMethod.CASH ? LedgerAccount.CASH : LedgerAccount.BANK;
        post(invoice, VoucherType.RECEIPT, payment.getId(), payment.getReceiptNumber(), payment.getPaymentDate(), money, payment.getAmount(), BigDecimal.ZERO, narration);
        post(invoice, VoucherType.RECEIPT, payment.getId(), payment.getReceiptNumber(), payment.getPaymentDate(), LedgerAccount.RECEIVABLES, BigDecimal.ZERO, payment.getAmount(), narration);
    }

    /** Reverses every entry the invoice posted. Its original entries stay in the books. */
    void postVoid(Invoice invoice, LocalDate date) {
        UUID workspaceId = invoice.getWorkspace().getId();
        if (entries.existsByWorkspaceIdAndVoucherTypeAndSourceId(workspaceId, VoucherType.INVOICE_VOID, invoice.getId())) return;
        String narration = "Invoice " + invoice.getInvoiceNumber() + " voided · " + invoice.getClient().getDisplayName();
        for (LedgerEntry original : entries.findByWorkspaceIdAndVoucherTypeAndSourceId(workspaceId, VoucherType.INVOICE, invoice.getId()))
            post(invoice, VoucherType.INVOICE_VOID, invoice.getId(), invoice.getInvoiceNumber(), date, original.getAccount(), original.getCredit(), original.getDebit(), narration);
    }

    private void post(Invoice invoice, VoucherType type, UUID source, String number, LocalDate date, LedgerAccount account,
            BigDecimal debit, BigDecimal credit, String narration) {
        if (debit.signum() == 0 && credit.signum() == 0) return;
        LedgerEntry entry = new LedgerEntry();
        entry.setWorkspace(invoice.getWorkspace());
        entry.setEntryDate(date);
        entry.setVoucherType(type);
        entry.setVoucherNumber(number);
        entry.setSourceId(source);
        entry.setInvoice(invoice);
        entry.setClient(invoice.getClient());
        entry.setAccount(account);
        entry.setDebit(debit);
        entry.setCredit(credit);
        entry.setCurrency(invoice.getCurrency());
        entry.setNarration(narration.length() > 300 ? narration.substring(0, 300) : narration);
        entries.save(entry);
    }

    private static LedgerAccount taxAccount(String label) {
        return switch (label) {
            case "CGST" -> LedgerAccount.OUTPUT_CGST;
            case "SGST" -> LedgerAccount.OUTPUT_SGST;
            case "IGST" -> LedgerAccount.OUTPUT_IGST;
            default -> LedgerAccount.OUTPUT_TAX;
        };
    }

    // ---------------------------------------------------------------- settings and years

    @Transactional(readOnly = true)
    public BookSettings settings() {
        FinanceWorkspace workspace = workspace();
        int start = workspace == null ? 4 : workspace.getFiscalYearStartMonth();
        return new BookSettings(start, workspace == null ? null : workspace.getBooksLockedUntil(), FiscalYear.containing(today(), start).label());
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public BookSettings updateSettings(UpdateBookSettings request) {
        FinanceWorkspace workspace = scope.locked();
        if (request.booksLockedUntil() != null && request.booksLockedUntil().isAfter(today()))
            throw new FinanceException(400, "The books can only be locked up to today");
        workspace.setFiscalYearStartMonth(request.fiscalYearStartMonth());
        workspace.setBooksLockedUntil(request.booksLockedUntil());
        workspaces.saveAndFlush(workspace);
        return settings();
    }

    /** Every financial year from the first posting to the current one, newest first. */
    @Transactional(readOnly = true)
    public List<FiscalYearOption> years() {
        int start = startMonth();
        FiscalYear current = FiscalYear.containing(today(), start);
        LocalDate first = entries.firstEntryDate(scope.context().workspaceId());
        FiscalYear year = FiscalYear.containing(first == null || first.isAfter(today()) ? today() : first, start);
        List<FiscalYearOption> options = new ArrayList<>();
        while (!year.start().isAfter(current.start())) {
            options.add(0, new FiscalYearOption(year.label(), year.start(), year.end(), year.equals(current)));
            year = FiscalYear.starting(year.start().getYear() + 1, start);
        }
        return options;
    }

    // ---------------------------------------------------------------- reports

    @Transactional(readOnly = true)
    public YearSummary summary(String label) {
        FiscalYear year = year(label);
        UUID workspaceId = scope.context().workspaceId();
        Map<String, BigDecimal> opening = totals(entries.balanceBefore(workspaceId, LedgerAccount.RECEIVABLES, year.start()));
        Map<String, Map<YearMonth, Month>> byCurrency = new TreeMap<>();
        for (String currency : opening.keySet()) byCurrency.put(currency, new LinkedHashMap<>());
        for (LedgerEntry entry : entries.findPeriod(workspaceId, year.start(), year.end()))
            byCurrency.computeIfAbsent(entry.getCurrency(), c -> new LinkedHashMap<>())
                    .computeIfAbsent(YearMonth.from(entry.getEntryDate()), m -> new Month()).add(entry);
        List<CurrencySummary> currencies = new ArrayList<>();
        byCurrency.forEach((currency, months) -> {
            BigDecimal balance = opening.getOrDefault(currency, BigDecimal.ZERO);
            List<MonthRow> rows = new ArrayList<>();
            Month total = new Month();
            for (YearMonth month : year.months()) {
                Month m = months.getOrDefault(month, new Month());
                balance = balance.add(m.receivables);
                total.merge(m);
                rows.add(m.row(month.toString(), month.atDay(1), month.atEndOfMonth(), balance));
            }
            currencies.add(new CurrencySummary(currency, opening.getOrDefault(currency, BigDecimal.ZERO), rows,
                    total.row("total", year.start(), year.end(), balance), balance));
        });
        FinanceWorkspace workspace = workspace();
        return new YearSummary(year.label(), year.start(), year.end(), workspace == null ? null : workspace.getBooksLockedUntil(), currencies);
    }

    @Transactional(readOnly = true)
    public SalesRegister salesRegister(String label, String month) {
        FiscalYear year = year(label);
        LocalDate[] range = range(year, month);
        Map<String, Row> rows = new LinkedHashMap<>();
        for (LedgerEntry entry : entries.findPeriod(scope.context().workspaceId(), range[0], range[1])) {
            if (entry.getVoucherType() == VoucherType.RECEIPT) continue;
            rows.computeIfAbsent(entry.getVoucherType() + ":" + entry.getSourceId(), key -> new Row(entry)).add(entry);
        }
        Map<String, RegisterTotal> totals = new TreeMap<>();
        List<SalesRegisterRow> result = new ArrayList<>();
        for (Row row : rows.values()) {
            SalesRegisterRow line = row.toRow();
            result.add(line);
            totals.merge(line.currency(), new RegisterTotal(line.currency(), line.voucherType() == VoucherType.INVOICE ? 1 : 0, line.taxable(), line.cgst(), line.sgst(),
                    line.igst(), line.otherTax(), line.total()), (a, b) -> new RegisterTotal(a.currency(), a.invoices() + b.invoices(), a.taxable().add(b.taxable()),
                    a.cgst().add(b.cgst()), a.sgst().add(b.sgst()), a.igst().add(b.igst()), a.otherTax().add(b.otherTax()), a.total().add(b.total())));
        }
        return new SalesRegister(year.label(), month, result, List.copyOf(totals.values()));
    }

    @Transactional(readOnly = true)
    public Journal journal(String label, String month, LedgerAccount account, String clientKey, int page, int size) {
        if (page < 0 || size < 1 || size > 200) throw new FinanceException(400, "Page must be zero or more and size between 1 and 200");
        FiscalYear year = year(label);
        LocalDate[] range = range(year, month);
        Predicate<LedgerEntry> matches = entry -> (account == null || entry.getAccount() == account)
                && (clientKey == null || clientKey.isBlank() || entry.getClient().getClientKey().equals(clientKey.trim()));
        List<LedgerEntry> all = entries.findPeriod(scope.context().workspaceId(), range[0], range[1]).stream().filter(matches).toList();
        Map<String, BigDecimal[]> totals = new TreeMap<>();
        for (LedgerEntry entry : all) {
            BigDecimal[] sum = totals.computeIfAbsent(entry.getCurrency(), c -> new BigDecimal[] {BigDecimal.ZERO, BigDecimal.ZERO});
            sum[0] = sum[0].add(entry.getDebit());
            sum[1] = sum[1].add(entry.getCredit());
        }
        List<JournalLine> content = all.stream().skip((long) page * size).limit(size).map(entry -> new JournalLine(entry.getEntryDate(), entry.getVoucherType(),
                entry.getVoucherNumber(), entry.getInvoice().getReference(), entry.getClient().getClientKey(), entry.getClient().getDisplayName(),
                entry.getAccount(), entry.getAccount().displayName(), entry.getCurrency(), entry.getDebit(), entry.getCredit(), entry.getNarration())).toList();
        return new Journal(year.label(), month, content, page, size, all.size(), (int) Math.ceil(all.size() / (double) size),
                totals.entrySet().stream().map(e -> new CurrencyTotal(e.getKey(), e.getValue()[0], e.getValue()[1])).toList());
    }

    @Transactional(readOnly = true)
    public Statement statement(String clientKey, String label) {
        FiscalYear year = year(label);
        UUID workspaceId = scope.context().workspaceId();
        BillingClient client = clients.findByWorkspaceIdAndClientKey(workspaceId, clientKey == null ? "" : clientKey.trim())
                .orElseThrow(() -> new FinanceException(404, "Client not found"));
        Map<String, BigDecimal> opening = totals(entries.clientBalanceBefore(workspaceId, client.getId(), year.start()));
        Map<String, List<LedgerEntry>> byCurrency = new TreeMap<>();
        for (String currency : opening.keySet()) byCurrency.put(currency, new ArrayList<>());
        for (LedgerEntry entry : entries.clientReceivables(workspaceId, client.getId(), year.start(), year.end()))
            byCurrency.computeIfAbsent(entry.getCurrency(), c -> new ArrayList<>()).add(entry);
        if (byCurrency.isEmpty()) byCurrency.put(client.getCurrency(), List.of());
        List<CurrencyStatement> statements = new ArrayList<>();
        byCurrency.forEach((currency, list) -> {
            BigDecimal start = opening.getOrDefault(currency, BigDecimal.ZERO), balance = start, debit = BigDecimal.ZERO, credit = BigDecimal.ZERO;
            List<StatementLine> lines = new ArrayList<>();
            for (LedgerEntry entry : list) {
                balance = balance.add(entry.net());
                debit = debit.add(entry.getDebit());
                credit = credit.add(entry.getCredit());
                lines.add(new StatementLine(entry.getEntryDate(), entry.getVoucherType(), entry.getVoucherNumber(), entry.getInvoice().getReference(),
                        entry.getNarration(), entry.getDebit(), entry.getCredit(), balance));
            }
            statements.add(new CurrencyStatement(currency, start, lines, debit, credit, balance));
        });
        return new Statement(year.label(), year.start(), year.end(), client.getClientKey(), client.getDisplayName(), statements);
    }

    // ---------------------------------------------------------------- helpers

    private FiscalYear year(String label) {
        int start = startMonth();
        return label == null || label.isBlank() ? FiscalYear.containing(today(), start) : FiscalYear.parse(label.trim(), start);
    }

    private static LocalDate[] range(FiscalYear year, String month) {
        if (month == null || month.isBlank()) return new LocalDate[] {year.start(), year.end()};
        YearMonth value;
        try { value = YearMonth.parse(month.trim()); } catch (RuntimeException invalid) { throw new FinanceException(400, "Month must look like 2026-05"); }
        if (!year.contains(value.atDay(1))) throw new FinanceException(400, month + " is not in financial year " + year.label());
        return new LocalDate[] {value.atDay(1), value.atEndOfMonth()};
    }

    private int startMonth() {
        FinanceWorkspace workspace = workspace();
        return workspace == null ? 4 : workspace.getFiscalYearStartMonth();
    }

    private FinanceWorkspace workspace() {
        return workspaces.findById(scope.context().workspaceId()).orElse(null);
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }

    private static Map<String, BigDecimal> totals(List<Object[]> rows) {
        Map<String, BigDecimal> values = new TreeMap<>();
        for (Object[] row : rows) if (row[1] != null) values.put((String) row[0], (BigDecimal) row[1]);
        return values;
    }

    /** Month accumulator. Credit-side accounts (sales, taxes) are counted credit − debit, so reversals subtract. */
    private static final class Month {
        final Set<UUID> issued = new java.util.HashSet<>(), voided = new java.util.HashSet<>();
        BigDecimal taxable = BigDecimal.ZERO, cgst = BigDecimal.ZERO, sgst = BigDecimal.ZERO, igst = BigDecimal.ZERO, other = BigDecimal.ZERO;
        BigDecimal invoiced = BigDecimal.ZERO, collected = BigDecimal.ZERO, receivables = BigDecimal.ZERO;

        void add(LedgerEntry entry) {
            BigDecimal income = entry.getCredit().subtract(entry.getDebit());
            switch (entry.getAccount()) {
                case SALES -> taxable = taxable.add(income);
                case OUTPUT_CGST -> cgst = cgst.add(income);
                case OUTPUT_SGST -> sgst = sgst.add(income);
                case OUTPUT_IGST -> igst = igst.add(income);
                case OUTPUT_TAX -> other = other.add(income);
                case RECEIVABLES -> {
                    receivables = receivables.add(entry.net());
                    if (entry.getVoucherType() == VoucherType.RECEIPT) collected = collected.add(entry.getCredit());
                    else invoiced = invoiced.add(entry.net());
                    if (entry.getVoucherType() == VoucherType.INVOICE) issued.add(entry.getSourceId());
                    if (entry.getVoucherType() == VoucherType.INVOICE_VOID) voided.add(entry.getSourceId());
                }
                default -> { }
            }
        }

        void merge(Month other) {
            issued.addAll(other.issued);
            voided.addAll(other.voided);
            taxable = taxable.add(other.taxable); cgst = cgst.add(other.cgst); sgst = sgst.add(other.sgst); igst = igst.add(other.igst);
            this.other = this.other.add(other.other); invoiced = invoiced.add(other.invoiced); collected = collected.add(other.collected);
            receivables = receivables.add(other.receivables);
        }

        MonthRow row(String label, LocalDate start, LocalDate end, BigDecimal closing) {
            return new MonthRow(label, start, end, issued.size(), voided.size(), taxable, cgst, sgst, igst, other, invoiced, collected, closing);
        }
    }

    /** Sales register line for one invoice voucher. */
    private final class Row {
        final LedgerEntry first;
        BigDecimal taxable = BigDecimal.ZERO, cgst = BigDecimal.ZERO, sgst = BigDecimal.ZERO, igst = BigDecimal.ZERO, other = BigDecimal.ZERO, total = BigDecimal.ZERO;

        Row(LedgerEntry first) { this.first = first; }

        void add(LedgerEntry entry) {
            BigDecimal income = entry.getCredit().subtract(entry.getDebit());
            switch (entry.getAccount()) {
                case SALES -> taxable = taxable.add(income);
                case OUTPUT_CGST -> cgst = cgst.add(income);
                case OUTPUT_SGST -> sgst = sgst.add(income);
                case OUTPUT_IGST -> igst = igst.add(income);
                case OUTPUT_TAX -> other = other.add(income);
                case RECEIVABLES -> total = total.add(entry.net());
                default -> { }
            }
        }

        SalesRegisterRow toRow() {
            Invoice invoice = first.getInvoice();
            String taxId = invoice.getClient().getTaxId(), name = invoice.getClient().getDisplayName();
            if (invoice.getTemplateSnapshot() != null) {
                DocumentSnapshot snapshot = json.readValue(invoice.getTemplateSnapshot(), DocumentSnapshot.class);
                if (snapshot.billTo() != null) { taxId = snapshot.billTo().taxId(); name = snapshot.billTo().name(); }
            }
            return new SalesRegisterRow(first.getEntryDate(), first.getVoucherType(), first.getVoucherNumber(), invoice.getReference(),
                    invoice.getClient().getClientKey(), name, taxId, invoice.getPlaceOfSupply(), first.getCurrency(), taxable, cgst, sgst, igst, other, total);
        }
    }
}
