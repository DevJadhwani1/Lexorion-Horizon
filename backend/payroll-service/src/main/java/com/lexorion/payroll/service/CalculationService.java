package com.lexorion.payroll.service;

import static com.lexorion.payroll.api.CalculationDtos.*;
import com.lexorion.payroll.api.PayrollException;
import com.lexorion.payroll.domain.*;
import com.lexorion.payroll.entitlement.PayrollProcessingEntitlementGate;
import com.lexorion.payroll.repository.*;
import java.math.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class CalculationService {
    private static final int SCALE = 4;
    private static final RoundingMode ROUNDING = RoundingMode.HALF_UP;
    private final PayrollWorkspaceScope scope;
    private final PayrollEmployeeRepository employees;
    private final CompensationProfileRepository profiles;
    private final CalculationRepository calculations;
    private final PayrollProcessingEntitlementGate entitlement;

    public CalculationService(PayrollWorkspaceScope scope, PayrollEmployeeRepository employees,
            CompensationProfileRepository profiles, CalculationRepository calculations,
            PayrollProcessingEntitlementGate entitlement) {
        this.scope = scope;
        this.employees = employees;
        this.profiles = profiles;
        this.calculations = calculations;
        this.entitlement = entitlement;
    }

    @Transactional(readOnly = true)
    public List<CalculationResponse> list(String rawEmployeeCode) {
        entitlement.requireProcessing(scope.context());
        String code = CompensationService.employeeCode(rawEmployeeCode);
        employees.findByWorkspaceIdAndEmployeeCode(scope.context().workspaceId(), code)
                .orElseThrow(() -> new PayrollException(404, "Payroll employee not found"));
        return calculations.findByWorkspaceIdAndEmployeeCodeOrderByCalculationDateAscCreatedAtAsc(
                scope.context().workspaceId(), code).stream().map(CalculationResponse::from).toList();
    }

    @Transactional(isolation = Isolation.REPEATABLE_READ)
    public CalculationResponse calculate(String rawEmployeeCode, CreateCalculation request) {
        entitlement.requireProcessing(scope.context());
        PayrollWorkspace workspace = scope.locked();
        return CalculationResponse.from(calculateSnapshot(workspace, rawEmployeeCode, request.calculationDate()));
    }

    Calculation calculateSnapshot(PayrollWorkspace workspace, String rawEmployeeCode, java.time.LocalDate calculationDate) {
        String code = CompensationService.employeeCode(rawEmployeeCode);
        employees.findScopedForUpdate(workspace.getId(), code)
                .orElseThrow(() -> new PayrollException(404, "Payroll employee not found"));
        List<CompensationProfile> effective = profiles.findEffective(workspace.getId(), code, calculationDate);
        if (effective.isEmpty()) throw new PayrollException(404, "No effective compensation profile");
        if (effective.size() != 1) throw new PayrollException(409, "Conflicting effective compensation profiles");
        CompensationProfile profile = effective.getFirst();
        List<ComponentAssignment> ordered = profile.getAssignments().stream()
                .sorted(Comparator.comparing(a -> a.getDefinition().getComponentKey())).toList();
        if (ordered.isEmpty()) throw new PayrollException(409, "Effective compensation profile has no components");

        BigDecimal fixedGross = sum(ordered, ComponentCategory.EARNING, AmountType.FIXED_AMOUNT, BigDecimal.ZERO);
        BigDecimal percentageEarnings = sum(ordered, ComponentCategory.EARNING, AmountType.PERCENTAGE, fixedGross);
        BigDecimal gross = money(fixedGross.add(percentageEarnings));
        BigDecimal fixedDeductions = sum(ordered, ComponentCategory.DEDUCTION, AmountType.FIXED_AMOUNT, BigDecimal.ZERO);
        BigDecimal percentageDeductions = sum(ordered, ComponentCategory.DEDUCTION, AmountType.PERCENTAGE, gross);
        BigDecimal deductions = money(fixedDeductions.add(percentageDeductions));
        if (deductions.compareTo(gross) > 0) throw new PayrollException(409, "Deductions exceed gross earnings");

        Calculation calculation = new Calculation();
        calculation.setWorkspace(workspace);
        calculation.setEmployeeCode(code);
        calculation.setCalculationDate(calculationDate);
        calculation.setCurrency(profile.getCurrency());
        calculation.setGrossAmount(gross);
        calculation.setDeductionAmount(deductions);
        calculation.setNetAmount(money(gross.subtract(deductions)));
        for (ComponentAssignment assignment : ordered) {
            ComponentDefinition definition = assignment.getDefinition();
            BigDecimal base = definition.getAmountType() == AmountType.FIXED_AMOUNT ? BigDecimal.ZERO
                    : definition.getCategory() == ComponentCategory.EARNING ? fixedGross : gross;
            CalculationLine line = new CalculationLine();
            line.setCalculation(calculation);
            line.setComponentKey(definition.getComponentKey());
            line.setDisplayName(definition.getDisplayName());
            line.setCategory(definition.getCategory());
            line.setAmountType(definition.getAmountType());
            line.setOccurrence(definition.getOccurrenceType());
            line.setTaxability(definition.getTaxability());
            line.setConfiguredValue(money(assignment.getValue()));
            line.setCalculatedAmount(amount(assignment, base));
            line.setCurrency(profile.getCurrency());
            calculation.getLines().add(line);
        }
        return calculations.saveAndFlush(calculation);
    }

    private BigDecimal sum(List<ComponentAssignment> assignments, ComponentCategory category,
            AmountType type, BigDecimal base) {
        return money(assignments.stream().filter(a -> a.getDefinition().getCategory() == category)
                .filter(a -> a.getDefinition().getAmountType() == type)
                .map(a -> amount(a, base)).reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    private BigDecimal amount(ComponentAssignment assignment, BigDecimal base) {
        if (assignment.getDefinition().getAmountType() == AmountType.FIXED_AMOUNT) return money(assignment.getValue());
        return money(base.multiply(assignment.getValue()).divide(new BigDecimal("100"), SCALE, ROUNDING));
    }

    private BigDecimal money(BigDecimal value) {
        BigDecimal result;
        try { result = value.setScale(SCALE, ROUNDING); }
        catch (ArithmeticException ex) { throw new PayrollException(409, "Calculation precision is invalid"); }
        if (result.precision() - result.scale() > 15) throw new PayrollException(409, "Calculated amount exceeds supported precision");
        return result;
    }
}
