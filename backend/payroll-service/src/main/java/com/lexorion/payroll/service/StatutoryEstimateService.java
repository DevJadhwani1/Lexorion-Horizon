package com.lexorion.payroll.service;

import static com.lexorion.payroll.api.PayrollSetupDtos.*;

import com.lexorion.payroll.api.PayrollException;
import com.lexorion.payroll.domain.*;
import com.lexorion.payroll.repository.*;
import java.math.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Monthly EPF and ESI estimate for one employee from effective-dated rule versions and the employer's own
 * applicability decisions. It is an estimate for setup and review: nothing is saved, nothing is added to the
 * salary, and pay runs never use it. Professional tax, LWF and income-tax TDS are reported as unavailable.
 */
@Service
public class StatutoryEstimateService {
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal HALF = new BigDecimal("0.5");
    private static final String IN = "IN";

    private final PayrollEmployeeService employees;
    private final StatutoryProfileRepository profiles;
    private final StatutoryRuleVersionRepository rules;

    public StatutoryEstimateService(PayrollEmployeeService employees, StatutoryProfileRepository profiles, StatutoryRuleVersionRepository rules) {
        this.employees = employees; this.profiles = profiles; this.rules = rules;
    }

    @Transactional(readOnly = true)
    public EstimateResponse estimate(String rawCode, EstimateRequest request) {
        PayrollEmployee employee = employees.find(rawCode);
        if (request.basicWages().compareTo(request.grossWages()) > 0)
            throw new PayrollException(400, "Basic wages cannot exceed gross wages");
        StatutoryProfile profile = profiles.findByPayrollEmployeeId(employee.getId()).orElse(null);
        List<EstimateLine> lines = new ArrayList<>();
        List<RuleSource> sources = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        BigDecimal gross = request.grossWages();
        BigDecimal pfWages = pfWages(request.basicWages(), gross);
        if (pfWages.compareTo(request.basicWages()) > 0)
            warnings.add("PF wages include " + inr(pfWages.subtract(request.basicWages())) + " of allowances because excluded allowances exceed half of total pay (Code on Social Security, 2020, definition of wages). Confirm the wage split with your payroll adviser.");

        if (!"INR".equals(employee.getCurrency())) {
            for (String scheme : List.of("EPF", "ESI"))
                lines.add(new EstimateLine(scheme, scheme + " contributions", Party.EMPLOYEE, null, EstimateStatus.UNAVAILABLE, "Indian statutory contributions are estimated for INR payroll only."));
        } else {
            epf(request.asOf(), profile, pfWages, lines, sources, warnings);
            esi(request.asOf(), profile, gross, lines, sources, warnings);
        }
        unavailable(profile, lines);

        BigDecimal employeeTotal = total(lines, Party.EMPLOYEE), employer = total(lines, Party.EMPLOYER);
        return new EstimateResponse(employee.getEmployeeCode(), request.asOf(), employee.getCurrency(), money(pfWages), money(gross),
                employeeTotal, employer, lines, sources, warnings);
    }

    /**
     * Wages for EPF: basic and DA, plus any amount by which the other allowances exceed 50% of total pay
     * (Code on Social Security, 2020, s. 2(88) proviso).
     */
    static BigDecimal pfWages(BigDecimal basic, BigDecimal gross) {
        BigDecimal excluded = gross.subtract(basic);
        BigDecimal excess = excluded.subtract(gross.multiply(HALF));
        return excess.signum() > 0 ? basic.add(excess) : basic;
    }

    private void epf(LocalDate asOf, StatutoryProfile profile, BigDecimal wages, List<EstimateLine> lines, List<RuleSource> sources, List<String> warnings) {
        StatutoryApplicability applicability = profile == null ? null : profile.getPfApplicability();
        if (applicability != StatutoryApplicability.APPLICABLE) {
            boolean decided = applicability == StatutoryApplicability.NOT_APPLICABLE;
            lines.add(new EstimateLine("EPF", "Provident fund", Party.EMPLOYEE, null, decided ? EstimateStatus.NOT_APPLICABLE : EstimateStatus.NEEDS_DECISION,
                    decided ? "Marked as not applicable for this employee." : "Decide whether EPF applies to this employee in Payroll setup."));
            return;
        }
        StatutoryRuleVersion rule = rule(StatutoryScheme.EPF, asOf, sources);
        if (rule == null) {
            lines.add(new EstimateLine("EPF", "Provident fund", Party.EMPLOYEE, null, EstimateStatus.UNAVAILABLE, "No EPF rule version is recorded for " + asOf + "."));
            return;
        }
        BigDecimal ceiling = rule.getWageCeiling();
        boolean aboveCeiling = wages.compareTo(ceiling) > 0;
        BigDecimal contributory = aboveCeiling && !profile.isPfHigherWagesOptIn() ? ceiling : wages;
        BigDecimal pensionWages = wages.min(rule.getPensionWageCeiling() == null ? ceiling : rule.getPensionWageCeiling());
        BigDecimal employeeShare = rupees(percent(contributory, rule.getEmployeeRate()));
        BigDecimal employerTotal = rupees(percent(contributory, rule.getEmployerRate()));
        BigDecimal pension = rupees(percent(pensionWages, rule.getPensionRate())).min(employerTotal);
        String basis = "On PF wages of " + inr(contributory) + (aboveCeiling ? (profile.isPfHigherWagesOptIn() ? " (above the " + inr(ceiling) + " ceiling by joint option)" : " (capped at the " + inr(ceiling) + " ceiling)") : "") + ".";
        lines.add(new EstimateLine("EPF", "Employee PF contribution", Party.EMPLOYEE, employeeShare, EstimateStatus.ESTIMATED, rate(rule.getEmployeeRate()) + " " + basis));
        lines.add(new EstimateLine("EPF", "Employer pension (EPS)", Party.EMPLOYER, pension, EstimateStatus.ESTIMATED, rate(rule.getPensionRate()) + " of wages up to " + inr(pensionWages.max(BigDecimal.ZERO)) + "."));
        lines.add(new EstimateLine("EPF", "Employer PF contribution", Party.EMPLOYER, employerTotal.subtract(pension), EstimateStatus.ESTIMATED, "Employer " + rate(rule.getEmployerRate()) + " less the EPS share. " + basis));
        if (aboveCeiling)
            warnings.add("PF wages exceed the EPF ceiling. A member who first joined after 1 September 2014 with wages above the ceiling may not be eligible for EPS; confirm membership history.");
        warnings.add("EDLI and EPF administration charges are employer costs that are not estimated here.");
    }

    private void esi(LocalDate asOf, StatutoryProfile profile, BigDecimal wages, List<EstimateLine> lines, List<RuleSource> sources, List<String> warnings) {
        StatutoryApplicability applicability = profile == null ? null : profile.getEsiApplicability();
        if (applicability != StatutoryApplicability.APPLICABLE) {
            boolean decided = applicability == StatutoryApplicability.NOT_APPLICABLE;
            lines.add(new EstimateLine("ESI", "Employees’ State Insurance", Party.EMPLOYEE, null, decided ? EstimateStatus.NOT_APPLICABLE : EstimateStatus.NEEDS_DECISION,
                    decided ? "Marked as not applicable for this employee." : "Decide whether ESI applies to this employee in Payroll setup."));
            return;
        }
        StatutoryRuleVersion rule = rule(StatutoryScheme.ESI, asOf, sources);
        if (rule == null) {
            lines.add(new EstimateLine("ESI", "Employees’ State Insurance", Party.EMPLOYEE, null, EstimateStatus.UNAVAILABLE, "No ESI rule version is recorded for " + asOf + "."));
            return;
        }
        if (wages.compareTo(rule.getWageCeiling()) > 0) {
            lines.add(new EstimateLine("ESI", "Employees’ State Insurance", Party.EMPLOYEE, null, EstimateStatus.ABOVE_CEILING,
                    "Gross wages are above the ESI coverage ceiling of " + inr(rule.getWageCeiling()) + ". An employee already covered stays covered until the end of the contribution period; review before payroll."));
            return;
        }
        // ESIC rounds contributions up to the next whole rupee.
        lines.add(new EstimateLine("ESI", "Employee ESI contribution", Party.EMPLOYEE, ceilRupees(percent(wages, rule.getEmployeeRate())), EstimateStatus.ESTIMATED, rate(rule.getEmployeeRate()) + " of gross wages of " + inr(wages) + "."));
        lines.add(new EstimateLine("ESI", "Employer ESI contribution", Party.EMPLOYER, ceilRupees(percent(wages, rule.getEmployerRate())), EstimateStatus.ESTIMATED, rate(rule.getEmployerRate()) + " of gross wages of " + inr(wages) + "."));
        warnings.add("Employees whose average daily wage is within the ESIC exemption limit pay no employee ESI share. That exemption is not checked here.");
    }

    private void unavailable(StatutoryProfile profile, List<EstimateLine> lines) {
        String ptState = profile == null ? null : profile.getPtState(), lwfState = profile == null ? null : profile.getLwfState();
        lines.add(new EstimateLine("PT", "Professional tax", Party.EMPLOYEE, null, EstimateStatus.UNAVAILABLE,
                "Not calculated. Professional tax slabs differ by state" + (ptState == null ? "" : " (" + IndianStates.NAMES.get(ptState) + ")") + " and are not configured in Horizon."));
        lines.add(new EstimateLine("LWF", "Labour welfare fund", Party.EMPLOYEE, null, EstimateStatus.UNAVAILABLE,
                "Not calculated. LWF rates and due months differ by state" + (lwfState == null ? "" : " (" + IndianStates.NAMES.get(lwfState) + ")") + " and are not configured in Horizon."));
        lines.add(new EstimateLine("TDS", "Income-tax (TDS on salary)", Party.EMPLOYEE, null, EstimateStatus.UNAVAILABLE,
                "Not calculated. TDS depends on the tax regime, projected annual income, declarations and the Income-tax Act in force for the tax year; Horizon records PAN and regime only."));
    }

    private StatutoryRuleVersion rule(StatutoryScheme scheme, LocalDate asOf, List<RuleSource> sources) {
        List<StatutoryRuleVersion> found = rules.findEffective(scheme, IN, asOf);
        if (found.isEmpty()) return null;
        StatutoryRuleVersion rule = found.getFirst();
        sources.add(new RuleSource(scheme.name(), rule.getEffectiveFrom(), rule.getEffectiveTo(), rule.getSourceReference(), rule.getSourceUrl(), rule.getReviewStatus()));
        return rule;
    }

    private static BigDecimal percent(BigDecimal amount, BigDecimal rate) { return amount.multiply(rate).divide(HUNDRED, 6, RoundingMode.HALF_UP); }
    /** EPFO rounds contributions to the nearest rupee. */
    private static BigDecimal rupees(BigDecimal value) { return value.setScale(0, RoundingMode.HALF_UP).setScale(2); }
    private static BigDecimal ceilRupees(BigDecimal value) { return value.setScale(0, RoundingMode.CEILING).setScale(2); }
    private static BigDecimal money(BigDecimal value) { return value.setScale(2, RoundingMode.HALF_UP); }
    private static String inr(BigDecimal value) { return java.text.NumberFormat.getCurrencyInstance(Locale.of("en", "IN")).format(value); }
    private static String rate(BigDecimal rate) { return rate.stripTrailingZeros().toPlainString() + "%"; }

    private static BigDecimal total(List<EstimateLine> lines, Party party) {
        return lines.stream().filter(l -> l.party() == party && l.status() == EstimateStatus.ESTIMATED).map(EstimateLine::amount)
                .reduce(BigDecimal.ZERO.setScale(2), BigDecimal::add);
    }
}
