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
        List<Section> sections = sectionsFor(employee, p, salary);

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

    static List<Section> sectionsFor(PayrollEmployee employee, StatutoryProfile profile, boolean salary) {
        List<Section> sections = new ArrayList<>();
        sections.add(enrollment(employee));
        sections.add(payment(profile));
        sections.add(tax(profile));
        sections.add(scheme("epf", "Provident fund (EPF)", profile == null ? null : profile.getPfApplicability(), profile != null && profile.getUan() != null, profile != null && profile.isPfVerified(), "UAN"));
        sections.add(scheme("esi", "Employees’ State Insurance (ESI)", profile == null ? null : profile.getEsiApplicability(), profile != null && profile.getEsiIpNumber() != null, profile != null && profile.isEsiVerified(), "ESI IP number"));
        sections.add(stateScheme("pt", "Professional tax", profile == null ? null : profile.getPtApplicability(), profile == null ? null : profile.getPtState()));
        sections.add(stateScheme("lwf", "Labour welfare fund", profile == null ? null : profile.getLwfApplicability(), profile == null ? null : profile.getLwfState()));
        sections.add(section("salary", "Salary", salary ? SectionStatus.COMPLETE : SectionStatus.NOT_STARTED, salary ? List.of() : List.of("Active salary with at least one pay component"), salary ? null : "A salary blocks inclusion in a pay run. The other sections do not."));
        return sections;
    }

    private static Section section(String key, String title, SectionStatus status, List<String> missing, String note) {
        return new Section(key, title, status, missing, note);
    }

    private static Section enrollment(PayrollEmployee e) {
        return section("enrollment", "Payroll enrollment", e.getStatus() == PayrollStatus.ACTIVE ? SectionStatus.COMPLETE : SectionStatus.IN_PROGRESS,
                e.getStatus() == PayrollStatus.ACTIVE ? List.of() : List.of("Active payroll status"),
                e.getStatus() == PayrollStatus.ACTIVE ? null : "Inactive enrollment blocks inclusion in a pay run.");
    }

    private static Section payment(StatutoryProfile p) {
        if (p == null || p.getPaymentMethod() == null) return section("payment", "Payment method", SectionStatus.NOT_STARTED, List.of("Payment method"), "Choose how this employee is paid. This does not block pay-run calculation.");
        if (p.getPaymentMethod() != PaymentMethod.BANK_TRANSFER) return section("payment", "Payment method", SectionStatus.COMPLETE, List.of(), "Cheque and cash do not require bank details or bank verification.");
        List<String> missing = new ArrayList<>();
        if (p.getBankAccountHolder() == null) missing.add("Account holder name");
        if (p.getBankAccountNumber() == null) missing.add("Account number");
        if (p.getBankIfsc() == null) missing.add("IFSC");
        if (!missing.isEmpty()) return section("payment", "Payment method", SectionStatus.IN_PROGRESS, missing, "Bank transfer needs an account holder, account number, and IFSC before payment. Calculation does not check them.");
        return section("payment", "Payment method", p.isBankVerified() ? SectionStatus.COMPLETE : SectionStatus.PENDING_VERIFICATION, List.of(), p.isBankVerified() ? "Bank details are saved and marked verified." : "Bank details are saved and not verified. Verify them before paying by bank transfer. Calculation and finalization do not check the account.");
    }

    private static Section tax(StatutoryProfile p) {
        if (p == null) return section("tax", "PAN and tax regime", SectionStatus.NOT_STARTED, List.of("PAN", "Tax regime"), "PAN and regime are part of setup. Horizon does not calculate income tax, and a blank PAN does not block a pay run.");
        boolean pan = p.getPan() != null, regime = p.getTaxRegime() != null;
        if (!pan && !regime) return section("tax", "PAN and tax regime", SectionStatus.NOT_STARTED, List.of("PAN", "Tax regime"), "PAN and regime are part of setup. Horizon does not calculate income tax, and a blank PAN does not block a pay run.");
        if (!pan || !regime) return section("tax", "PAN and tax regime", SectionStatus.IN_PROGRESS, List.of(pan ? "Tax regime" : "PAN"), "Finish the tax record that was started. This does not block a pay run.");
        return section("tax", "PAN and tax regime", p.isPanVerified() ? SectionStatus.COMPLETE : SectionStatus.PENDING_VERIFICATION, List.of(), p.isPanVerified() ? null : "PAN is saved and not verified. Verification does not block a pay run, and tax is not calculated.");
    }

    private static Section scheme(String key, String title, StatutoryApplicability applicability, boolean identifier, boolean verified, String identifierLabel) {
        if (applicability == null || applicability == StatutoryApplicability.UNDECIDED)
            return section(key, title, SectionStatus.NOT_STARTED, List.of("Decide whether it applies"), "Applicability is unresolved. Horizon does not treat that as not applicable, and it does not block a pay run.");
        if (applicability == StatutoryApplicability.NOT_APPLICABLE) return section(key, title, SectionStatus.NOT_APPLICABLE, List.of(), "Recorded as not applicable. That is an employer decision, not a calculated exemption.");
        if (!identifier) return section(key, title, SectionStatus.COMPLETE, List.of(), identifierLabel + " was not recorded. It is optional, so this section is not left in progress, and it does not block a pay run or an estimate.");
        return section(key, title, verified ? SectionStatus.COMPLETE : SectionStatus.PENDING_VERIFICATION, List.of(), verified ? null : identifierLabel + " is saved and not verified. Verification does not block a pay run.");
    }

    private static Section stateScheme(String key, String title, StatutoryApplicability applicability, String state) {
        if (applicability == null || applicability == StatutoryApplicability.UNDECIDED)
            return section(key, title, SectionStatus.NOT_STARTED, List.of("Decide whether it applies"), "Applicability is unresolved. Horizon does not treat that as not applicable, does not calculate this amount, and does not block a pay run.");
        if (applicability == StatutoryApplicability.NOT_APPLICABLE) return section(key, title, SectionStatus.NOT_APPLICABLE, List.of(), "Recorded as not applicable. A missing state is expected and is not a compliance determination.");
        if (state == null) return section(key, title, SectionStatus.IN_PROGRESS, List.of("State"), "Record the state this decision refers to. A state code is not a calculation, and this does not block a pay run.");
        return section(key, title, SectionStatus.COMPLETE, List.of(), "The state is recorded. That does not mean the amount was calculated or that the state levies it.");
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
