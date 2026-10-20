package com.lexorion.payroll.service;

import com.lexorion.payroll.api.PayrollException;
import com.lexorion.payroll.domain.*;
import com.lexorion.payroll.repository.PayRunEmployeeRepository;
import java.math.*;
import org.springframework.stereotype.Component;

/** One source of truth for preparation and processing; evaluation never persists a calculation. */
@Component
public class PayRunEligibility {
    private final PayRunEmployeeRepository included;
    private final CalculationService calculations;
    public PayRunEligibility(PayRunEmployeeRepository included, CalculationService calculations) {
        this.included = included; this.calculations = calculations;
    }
    void validatePeriod(PayRun run) {
        if (run.getPeriodEnd().isBefore(run.getPeriodStart()))
            throw new PayrollException(400, "Period end must not precede period start");
        if (run.getCalculationDate().isBefore(run.getPeriodStart()))
            throw new PayrollException(400, "Calculation date must not precede period start");
    }
    Calculation evaluate(PayRun run, PayrollEmployee employee) {
        validatePeriod(run);
        if (employee.getStatus() != PayrollStatus.ACTIVE)
            throw new PayrollException(409, "Pay Run contains an inactive payroll employee");
        var workspace = run.getWorkspace();
        if (included.countCommittedOverlap(workspace.getId(), employee.getEmployeeCode(), run.getId(), run.getPeriodStart(), run.getPeriodEnd()) != 0)
            throw new PayrollException(409, "Employee already has a calculated or finalized pay run overlapping this period");
        Calculation calculation = calculations.evaluate(workspace, employee, run.getCalculationDate(), run.getPeriodStart(), run.getPeriodEnd());
        for (CalculationLine line : calculation.getLines()) {
            if (line.getOccurrence() == OccurrenceType.ONE_TIME && included.countConsumedOneTime(workspace.getId(),
                    employee.getEmployeeCode(), run.getId(), line.getSourceAssignmentId()) != 0)
                throw new PayrollException(409, "One-time compensation was already included in another calculated or finalized run");
        }
        if (!run.getCurrency().equals(calculation.getCurrency()))
            throw new PayrollException(409, "Employee calculation currency does not match Pay Run currency");
        return calculation;
    }
    static BigDecimal money(BigDecimal value) {
        BigDecimal result = value.setScale(4, RoundingMode.HALF_UP);
        if (result.precision() - result.scale() > 15) throw new PayrollException(409, "Pay Run total exceeds supported precision");
        return result;
    }
}
