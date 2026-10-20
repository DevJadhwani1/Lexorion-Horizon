package com.lexorion.payroll.service;

import com.lexorion.payroll.api.PayrollException;
import com.lexorion.payroll.domain.*;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/** Inclusive full periods; no proration. See docs/payroll-period-semantics.md. */
record PayrollPeriod(LocalDate start, LocalDate end) {
    static PayrollPeriod containing(PayrollEmployee employee, LocalDate date) {
        if (employee.getPayFrequency() == PayFrequency.MONTHLY)
            return new PayrollPeriod(date.withDayOfMonth(1), date.withDayOfMonth(date.lengthOfMonth()));
        int days = employee.getPayFrequency() == PayFrequency.WEEKLY ? 7 : 14;
        long offset = Math.floorDiv(ChronoUnit.DAYS.between(employee.getEffectiveFrom(), date), days) * days;
        LocalDate start = employee.getEffectiveFrom().plusDays(offset);
        return new PayrollPeriod(start, start.plusDays(days - 1));
    }
    void validate(PayrollEmployee employee, CompensationProfile profile) {
        if (employee.getStatus() != PayrollStatus.ACTIVE) throw new PayrollException(409, "Payroll employee is not active for calculation");
        if (employee.getPayFrequency() != profile.getPayFrequency())
            throw new PayrollException(409, "Compensation pay frequency does not match employee; use a compatible compensation profile");
        PayrollPeriod expected = containing(employee, start);
        if (!equals(expected)) throw new PayrollException(409, "Pay period is incompatible with employee pay frequency (full aligned periods required)");
        if (employee.getEffectiveFrom().isAfter(start) || profile.getEffectiveFrom().isAfter(start)
                || (profile.getEffectiveTo() != null && profile.getEffectiveTo().isBefore(end)))
            throw new PayrollException(409, "Compensation and employee eligibility must cover the entire pay period; proration is not supported");
    }
    boolean includes(ComponentAssignment assignment) {
        return assignment.getOccurrenceType() == OccurrenceType.RECURRING
                || assignment.getProfile().getEffectiveFrom().equals(start);
    }
}
