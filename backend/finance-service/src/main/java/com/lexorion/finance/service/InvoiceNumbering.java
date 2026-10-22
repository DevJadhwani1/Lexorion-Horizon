package com.lexorion.finance.service;

import com.lexorion.finance.api.FinanceException;
import com.lexorion.finance.api.TemplateConfig;
import com.lexorion.finance.domain.FinanceWorkspace;
import com.lexorion.finance.domain.NumberSequence;
import com.lexorion.finance.repository.InvoiceRepository;
import com.lexorion.finance.repository.NumberSequenceRepository;
import java.time.LocalDate;
import java.util.Locale;
import java.util.regex.Matcher;
import org.springframework.stereotype.Component;

/**
 * Renders invoice numbers from a template pattern such as {@code OH/{FY}/{SEQ}} → {@code OH/26-27/0001}.
 * The serial is kept per rendered prefix ("scope"), so a pattern with {FY} restarts every financial year.
 * Callers hold the workspace lock, which serializes every numbering write.
 */
@Component
public class InvoiceNumbering {
    static final int MAX_LENGTH = 32;
    private static final java.util.regex.Pattern TOKEN = java.util.regex.Pattern.compile("\\{([A-Z]+)}");
    private static final java.util.regex.Pattern LITERAL = java.util.regex.Pattern.compile("^[A-Za-z0-9/_.\\-]*$");
    private final NumberSequenceRepository sequences;
    private final InvoiceRepository invoices;

    public InvoiceNumbering(NumberSequenceRepository sequences, InvoiceRepository invoices) {
        this.sequences = sequences;
        this.invoices = invoices;
    }

    /** Rejects patterns that cannot produce a valid, unique, sequential number. */
    public static void validate(TemplateConfig.Numbering numbering) {
        String pattern = numbering.pattern();
        Matcher tokens = TOKEN.matcher(pattern);
        int seq = 0;
        while (tokens.find()) {
            switch (tokens.group(1)) {
                case "SEQ" -> seq++;
                case "FY", "YYYY", "YY", "MM" -> { }
                default -> throw new FinanceException(400, "Unknown numbering token {" + tokens.group(1) + "}");
            }
        }
        if (seq != 1) throw new FinanceException(400, "The numbering pattern must contain {SEQ} exactly once");
        if (!LITERAL.matcher(TOKEN.matcher(pattern).replaceAll("")).matches())
            throw new FinanceException(400, "The numbering pattern may only contain letters, numbers, / _ . and -");
        String longest = render(numbering, LocalDate.of(2099, 12, 31), 999_999_999L);
        if (longest.length() > MAX_LENGTH) throw new FinanceException(400, "Invoice numbers from this pattern would exceed 32 characters");
    }

    /** The number the next issued invoice dated {@code date} would receive. Nothing is reserved. */
    public String preview(FinanceWorkspace workspace, TemplateConfig.Numbering numbering, LocalDate date) {
        long next = sequences.findByWorkspaceIdAndScope(workspace.getId(), scope(numbering, date)).map(NumberSequence::getNextValue).orElse(1L);
        return firstFree(workspace, numbering, date, next).number();
    }

    /** Consumes the next number. Skips any number already taken, for example by an earlier pattern. */
    public String next(FinanceWorkspace workspace, TemplateConfig.Numbering numbering, LocalDate date) {
        String scope = scope(numbering, date);
        NumberSequence sequence = sequences.findByWorkspaceIdAndScope(workspace.getId(), scope).orElseGet(() -> {
            NumberSequence created = new NumberSequence();
            created.setWorkspace(workspace);
            created.setScope(scope);
            return created;
        });
        Candidate candidate = firstFree(workspace, numbering, date, sequence.getNextValue());
        sequence.setNextValue(candidate.serial() + 1);
        sequences.save(sequence);
        return candidate.number();
    }

    private Candidate firstFree(FinanceWorkspace workspace, TemplateConfig.Numbering numbering, LocalDate date, long from) {
        long serial = from;
        String number = render(numbering, date, serial);
        while (invoices.existsByWorkspaceIdAndInvoiceNumber(workspace.getId(), number)) number = render(numbering, date, ++serial);
        return new Candidate(number, serial);
    }

    static String scope(TemplateConfig.Numbering numbering, LocalDate date) {
        String scope = substitute(numbering, date, "#");
        return scope.length() > 64 ? scope.substring(0, 64) : scope;
    }

    static String render(TemplateConfig.Numbering numbering, LocalDate date, long serial) {
        return substitute(numbering, date, String.format(Locale.ROOT, "%0" + numbering.padding() + "d", serial));
    }

    private static String substitute(TemplateConfig.Numbering numbering, LocalDate date, String serial) {
        return numbering.pattern()
                .replace("{SEQ}", serial)
                .replace("{FY}", fiscalYear(date, numbering.fiscalYearStartMonth()))
                .replace("{YYYY}", String.valueOf(date.getYear()))
                .replace("{YY}", String.format(Locale.ROOT, "%02d", date.getYear() % 100))
                .replace("{MM}", String.format(Locale.ROOT, "%02d", date.getMonthValue()));
    }

    /** "26-27" for a year starting in April 2026; just "2026" when the financial year is the calendar year. */
    static String fiscalYear(LocalDate date, int startMonth) {
        if (startMonth == 1) return String.valueOf(date.getYear());
        int start = date.getMonthValue() >= startMonth ? date.getYear() : date.getYear() - 1;
        return String.format(Locale.ROOT, "%02d-%02d", start % 100, (start + 1) % 100);
    }

    private record Candidate(String number, long serial) { }
}
