package com.lexorion.finance.service;

import com.lexorion.finance.api.FinanceException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * A financial year: "2026-27" runs 1 April 2026 to 31 March 2027 when it starts in April; with a January start it is
 * the calendar year and is labelled "2026".
 */
public record FiscalYear(String label, LocalDate start, LocalDate end) {
    public static FiscalYear containing(LocalDate date, int startMonth) {
        int startYear = date.getMonthValue() >= startMonth ? date.getYear() : date.getYear() - 1;
        return starting(startYear, startMonth);
    }

    public static FiscalYear starting(int startYear, int startMonth) {
        LocalDate start = LocalDate.of(startYear, startMonth, 1);
        String label = startMonth == 1 ? String.valueOf(startYear)
                : String.format(Locale.ROOT, "%d-%02d", startYear, (startYear + 1) % 100);
        return new FiscalYear(label, start, start.plusYears(1).minusDays(1));
    }

    /** Parses "2026-27" or "2026" for the workspace's start month. */
    public static FiscalYear parse(String label, int startMonth) {
        if (label == null || !label.matches("^\\d{4}(-\\d{2})?$")) throw new FinanceException(400, "Financial year must look like 2026-27");
        FiscalYear year = starting(Integer.parseInt(label.substring(0, 4)), startMonth);
        if (!year.label().equals(label)) throw new FinanceException(400, "Financial year " + label + " does not match a year starting in month " + startMonth);
        return year;
    }

    public List<YearMonth> months() {
        List<YearMonth> months = new ArrayList<>();
        for (YearMonth month = YearMonth.from(start); !month.isAfter(YearMonth.from(end)); month = month.plusMonths(1)) months.add(month);
        return months;
    }

    public boolean contains(LocalDate date) {
        return !date.isBefore(start) && !date.isAfter(end);
    }
}
