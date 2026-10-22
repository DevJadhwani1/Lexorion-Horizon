package com.lexorion.payroll.service;

import static com.lexorion.payroll.api.PayrollSetupDtos.*;

import com.lexorion.payroll.api.PayrollDtos.PayrollEmployeeResponse;
import com.lexorion.payroll.api.PayrollException;
import com.lexorion.payroll.domain.*;
import com.lexorion.payroll.repository.*;
import java.util.*;
import java.util.function.*;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Payroll setup for one employee: payment details, tax profile and statutory elections, with a per-section
 * status computed from saved data. Readiness is advisory; pay-run eligibility stays in PayRunEligibility.
 * Error messages never echo the submitted identifiers.
 */
@Service
public class PayrollSetupService {
    private static final Pattern PAN = Pattern.compile("^[A-Z]{5}[0-9]{4}[A-Z]$");
    private static final Pattern IFSC = Pattern.compile("^[A-Z]{4}0[A-Z0-9]{6}$");
    private static final Pattern ACCOUNT = Pattern.compile("^[A-Z0-9]{6,34}$");
    private static final Pattern INDIAN_ACCOUNT = Pattern.compile("^[0-9]{9,18}$");
    private static final Pattern UAN = Pattern.compile("^[0-9]{12}$");
    private static final Pattern ESI_IP = Pattern.compile("^[0-9]{10}$");

    private final PayrollWorkspaceScope scope;
    private final PayrollEmployeeService employees;
    private final StatutoryProfileRepository profiles;
    private final CompensationProfileRepository compensation;

    public PayrollSetupService(PayrollWorkspaceScope scope, PayrollEmployeeService employees,
            StatutoryProfileRepository profiles, CompensationProfileRepository compensation) {
        this.scope = scope; this.employees = employees; this.profiles = profiles; this.compensation = compensation;
    }

    @Transactional(readOnly = true)
    public SetupResponse get(String rawCode) {
        PayrollEmployee employee = employees.find(rawCode);
        return response(employee, profiles.findByPayrollEmployeeId(employee.getId()).orElse(null));
    }

    @Transactional
    public SetupResponse update(String rawCode, UpdateStatutoryProfile request) {
        PayrollWorkspace workspace = scope.locked();
        PayrollEmployee employee = employees.find(rawCode);
        StatutoryProfile profile = profiles.findByPayrollEmployeeId(employee.getId()).orElseGet(() -> {
            StatutoryProfile created = new StatutoryProfile();
            created.setPayrollEmployee(employee);
            created.setWorkspace(workspace);
            return created;
        });

        if (request.paymentMethod() != null) profile.setPaymentMethod(request.paymentMethod());
        if (request.bankAccountHolder() != null) profile.setBankAccountHolder(PayrollEmployeeService.blankToNull(request.bankAccountHolder()));
        if (request.bankName() != null) profile.setBankName(PayrollEmployeeService.blankToNull(request.bankName()));
        String ifsc = request.bankIfsc() == null ? profile.getBankIfsc() : identifier(request.bankIfsc(), IFSC, "IFSC must be 11 characters: 4 letters, 0, then 6 letters or digits");
        String account = request.bankAccountNumber() == null ? profile.getBankAccountNumber()
                : identifier(request.bankAccountNumber(), ACCOUNT, "Bank account number must be 6 to 34 letters or digits");
        if (account != null && ifsc != null && !INDIAN_ACCOUNT.matcher(account).matches())
            throw new PayrollException(400, "Indian bank account numbers have 9 to 18 digits");
        boolean bankChanged = !Objects.equals(ifsc, profile.getBankIfsc()) || !Objects.equals(account, profile.getBankAccountNumber());
        profile.setBankIfsc(ifsc);
        profile.setBankAccountNumber(account);
        profile.setBankVerified(verified(request.bankVerified(), profile.isBankVerified(), bankChanged, account != null));

        String pan = request.pan() == null ? profile.getPan() : identifier(request.pan(), PAN, "PAN must be 10 characters: 5 letters, 4 digits, 1 letter");
        unique(pan, profile.getPan(), "PAN", value -> profiles.findCodesWithPan(workspace.getId(), employee.getId(), value));
        boolean panChanged = !Objects.equals(pan, profile.getPan());
        profile.setPan(pan);
        profile.setPanVerified(verified(request.panVerified(), profile.isPanVerified(), panChanged, pan != null));
        if (request.taxRegime() != null) profile.setTaxRegime(request.taxRegime());

        if (request.pfApplicability() != null) profile.setPfApplicability(request.pfApplicability());
        String uan = request.uan() == null ? profile.getUan() : identifier(request.uan(), UAN, "UAN must be 12 digits");
        unique(uan, profile.getUan(), "UAN", value -> profiles.findCodesWithUan(workspace.getId(), employee.getId(), value));
        boolean uanChanged = !Objects.equals(uan, profile.getUan());
        profile.setUan(uan);
        if (request.pfMemberSince() != null) profile.setPfMemberSince(request.pfMemberSince());
        if (request.pfHigherWagesOptIn() != null) profile.setPfHigherWagesOptIn(request.pfHigherWagesOptIn());
        profile.setPfVerified(verified(request.pfVerified(), profile.isPfVerified(), uanChanged, uan != null));

        if (request.esiApplicability() != null) profile.setEsiApplicability(request.esiApplicability());
        String ip = request.esiIpNumber() == null ? profile.getEsiIpNumber() : identifier(request.esiIpNumber(), ESI_IP, "ESI IP number must be 10 digits");
        unique(ip, profile.getEsiIpNumber(), "ESI IP number", value -> profiles.findCodesWithEsiIpNumber(workspace.getId(), employee.getId(), value));
        boolean ipChanged = !Objects.equals(ip, profile.getEsiIpNumber());
        profile.setEsiIpNumber(ip);
        profile.setEsiVerified(verified(request.esiVerified(), profile.isEsiVerified(), ipChanged, ip != null));

        if (request.ptApplicability() != null) profile.setPtApplicability(request.ptApplicability());
        if (request.ptState() != null) profile.setPtState(IndianStates.optional(request.ptState(), "Professional tax state"));
        if (request.lwfApplicability() != null) profile.setLwfApplicability(request.lwfApplicability());
        if (request.lwfState() != null) profile.setLwfState(IndianStates.optional(request.lwfState(), "Labour welfare fund state"));

        return response(employee, profiles.saveAndFlush(profile));
    }

    /** Normalizes an identifier (upper case, no spaces or hyphens). Blank clears it. */
    private static String identifier(String raw, Pattern pattern, String message) {
        String value = raw.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
        if (value.isEmpty()) return null;
        if (!pattern.matcher(value).matches()) throw new PayrollException(400, message);
        return value;
    }

    private static void unique(String value, String previous, String label, Function<String, List<String>> lookup) {
        if (value == null || value.equals(previous)) return;
        List<String> holders = lookup.apply(value);
        if (!holders.isEmpty()) throw new PayrollException(409, "This " + label + " is already recorded for employee " + holders.getFirst());
    }

    /** A changed or cleared identifier is unverified unless this same request confirms it. */
    private static boolean verified(Boolean requested, boolean current, boolean changed, boolean present) {
        if (!present) return false;
        if (requested != null) return requested;
        return !changed && current;
    }

    SetupResponse response(PayrollEmployee employee, StatutoryProfile p) {
        boolean salary = compensation.findConfiguredEmployeeCodes(employee.getWorkspace().getId()).contains(employee.getEmployeeCode());
        List<Section> sections = new ArrayList<>();
        sections.add(enrollment(employee));
        sections.add(payment(p));
        sections.add(tax(p));
        sections.add(scheme("epf", "Provident fund (EPF)", p == null ? null : p.getPfApplicability(), p != null && p.getUan() != null, p != null && p.isPfVerified(), "UAN"));
        sections.add(scheme("esi", "Employees’ State Insurance (ESI)", p == null ? null : p.getEsiApplicability(), p != null && p.getEsiIpNumber() != null, p != null && p.isEsiVerified(), "ESI IP number"));
        sections.add(state("pt", "Professional tax", p == null ? null : p.getPtApplicability(), p == null ? null : p.getPtState()));
        sections.add(state("lwf", "Labour welfare fund", p == null ? null : p.getLwfApplicability(), p == null ? null : p.getLwfState()));
        sections.add(new Section("salary", "Salary", salary ? SectionStatus.COMPLETE : SectionStatus.NOT_STARTED, salary ? List.of() : List.of("Active salary with at least one pay component")));

        List<String> blockers = new ArrayList<>(), warnings = new ArrayList<>();
        if (employee.getStatus() != PayrollStatus.ACTIVE) blockers.add("Payroll enrollment is inactive");
        if (!salary) blockers.add("No active salary. Add pay components before including this employee in a pay run");
        for (Section section : sections) {
            if (section.key().equals("salary") || section.key().equals("enrollment")) continue;
            switch (section.status()) {
                case NOT_STARTED -> warnings.add(section.title() + ": not started");
                case IN_PROGRESS -> warnings.add(section.title() + ": " + String.join(", ", section.missing()) + " still needed");
                case PENDING_VERIFICATION -> warnings.add(section.title() + ": details saved but not yet verified");
                default -> { }
            }
        }
        boolean complete = sections.stream().allMatch(s -> s.status() == SectionStatus.COMPLETE || s.status() == SectionStatus.NOT_APPLICABLE);
        return new SetupResponse(PayrollEmployeeResponse.from(employee), p == null ? null : masked(p), salary, sections,
                new Readiness(blockers.isEmpty(), complete && blockers.isEmpty(), blockers, warnings));
    }

    private static Section enrollment(PayrollEmployee e) {
        return new Section("enrollment", "Payroll enrollment", e.getStatus() == PayrollStatus.ACTIVE ? SectionStatus.COMPLETE : SectionStatus.IN_PROGRESS,
                e.getStatus() == PayrollStatus.ACTIVE ? List.of() : List.of("Active payroll status"));
    }

    private static Section payment(StatutoryProfile p) {
        if (p == null || p.getPaymentMethod() == null) return new Section("payment", "Payment method", SectionStatus.NOT_STARTED, List.of("Payment method"));
        if (p.getPaymentMethod() != PaymentMethod.BANK_TRANSFER) return new Section("payment", "Payment method", SectionStatus.COMPLETE, List.of());
        List<String> missing = new ArrayList<>();
        if (p.getBankAccountHolder() == null) missing.add("Account holder name");
        if (p.getBankAccountNumber() == null) missing.add("Account number");
        if (p.getBankIfsc() == null) missing.add("IFSC");
        if (!missing.isEmpty()) return new Section("payment", "Payment method", SectionStatus.IN_PROGRESS, missing);
        return new Section("payment", "Payment method", p.isBankVerified() ? SectionStatus.COMPLETE : SectionStatus.PENDING_VERIFICATION, List.of());
    }

    private static Section tax(StatutoryProfile p) {
        boolean pan = p != null && p.getPan() != null, regime = p != null && p.getTaxRegime() != null;
        if (!pan && !regime) return new Section("tax", "PAN and tax regime", SectionStatus.NOT_STARTED, List.of("PAN", "Tax regime"));
        if (!pan || !regime) return new Section("tax", "PAN and tax regime", SectionStatus.IN_PROGRESS, List.of(pan ? "Tax regime" : "PAN"));
        return new Section("tax", "PAN and tax regime", p.isPanVerified() ? SectionStatus.COMPLETE : SectionStatus.PENDING_VERIFICATION, List.of());
    }

    private static Section scheme(String key, String title, StatutoryApplicability applicability, boolean identifier, boolean verified, String identifierLabel) {
        if (applicability == null || applicability == StatutoryApplicability.UNDECIDED)
            return new Section(key, title, SectionStatus.NOT_STARTED, List.of("Decide whether it applies"));
        if (applicability == StatutoryApplicability.NOT_APPLICABLE) return new Section(key, title, SectionStatus.NOT_APPLICABLE, List.of());
        if (!identifier) return new Section(key, title, SectionStatus.IN_PROGRESS, List.of(identifierLabel));
        return new Section(key, title, verified ? SectionStatus.COMPLETE : SectionStatus.PENDING_VERIFICATION, List.of());
    }

    private static Section state(String key, String title, StatutoryApplicability applicability, String state) {
        if (applicability == null || applicability == StatutoryApplicability.UNDECIDED)
            return new Section(key, title, SectionStatus.NOT_STARTED, List.of("Decide whether it applies"));
        if (applicability == StatutoryApplicability.NOT_APPLICABLE) return new Section(key, title, SectionStatus.NOT_APPLICABLE, List.of());
        return state == null ? new Section(key, title, SectionStatus.IN_PROGRESS, List.of("State")) : new Section(key, title, SectionStatus.COMPLETE, List.of());
    }

    static StatutoryProfileResponse masked(StatutoryProfile p) {
        return new StatutoryProfileResponse(p.getPaymentMethod(), p.getBankAccountHolder(), mask(p.getBankAccountNumber()), p.getBankIfsc(),
                p.getBankName(), p.isBankVerified(), mask(p.getPan()), p.isPanVerified(), p.getTaxRegime(),
                p.getPfApplicability(), mask(p.getUan()), p.getPfMemberSince(), p.isPfHigherWagesOptIn(), p.isPfVerified(),
                p.getEsiApplicability(), mask(p.getEsiIpNumber()), p.isEsiVerified(),
                p.getPtApplicability(), p.getPtState(), p.getLwfApplicability(), p.getLwfState());
    }

    /** Keeps the last four characters only, for example "••••6789". */
    static String mask(String value) {
        if (value == null) return null;
        return "••••" + value.substring(Math.max(0, value.length() - 4));
    }
}
