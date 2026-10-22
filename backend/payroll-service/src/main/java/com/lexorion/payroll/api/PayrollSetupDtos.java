package com.lexorion.payroll.api;

import com.lexorion.payroll.domain.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

public final class PayrollSetupDtos {
    private PayrollSetupDtos() {}

    /**
     * Partial update. A null field is left unchanged; an empty string clears it. Sensitive identifiers are
     * write-only: send a new value to replace one, never the masked value from a response.
     */
    public record UpdateStatutoryProfile(
            PaymentMethod paymentMethod,
            @Size(max = 150) String bankAccountHolder, @Size(max = 40) String bankAccountNumber,
            @Size(max = 11) String bankIfsc, @Size(max = 120) String bankName, Boolean bankVerified,
            @Size(max = 10) String pan, Boolean panVerified, TaxRegime taxRegime,
            StatutoryApplicability pfApplicability, @Size(max = 12) String uan, LocalDate pfMemberSince,
            Boolean pfHigherWagesOptIn, Boolean pfVerified,
            StatutoryApplicability esiApplicability, @Size(max = 10) String esiIpNumber, Boolean esiVerified,
            StatutoryApplicability ptApplicability, @Size(max = 6) String ptState,
            StatutoryApplicability lwfApplicability, @Size(max = 6) String lwfState,
            @Null UUID workspaceId, @Null UUID organizationId, @Null UUID payrollEmployeeId) {}

    /** Masked view. Identifiers show only their last four characters. */
    public record StatutoryProfileResponse(
            PaymentMethod paymentMethod, String bankAccountHolder, String bankAccountNumberMasked, String bankIfsc,
            String bankName, boolean bankVerified,
            String panMasked, boolean panVerified, TaxRegime taxRegime,
            StatutoryApplicability pfApplicability, String uanMasked, LocalDate pfMemberSince, boolean pfHigherWagesOptIn, boolean pfVerified,
            StatutoryApplicability esiApplicability, String esiIpNumberMasked, boolean esiVerified,
            StatutoryApplicability ptApplicability, String ptState, StatutoryApplicability lwfApplicability, String lwfState) {}

    public enum SectionStatus { NOT_STARTED, IN_PROGRESS, COMPLETE, NOT_APPLICABLE, PENDING_VERIFICATION }

    public record Section(String key, String title, SectionStatus status, List<String> missing) {}

    /**
     * readyForPayroll reflects the existing pay-run rules only (active enrollment and an active salary).
     * setupComplete additionally needs every section complete or not applicable; it is advisory and never
     * changes pay-run eligibility.
     */
    public record Readiness(boolean readyForPayroll, boolean setupComplete, List<String> blockers, List<String> warnings) {}

    public record SetupResponse(PayrollDtos.PayrollEmployeeResponse enrollment, StatutoryProfileResponse statutoryProfile,
            boolean salaryConfigured, List<Section> sections, Readiness readiness) {}

    /** basicWages is basic pay plus dearness allowance (and retaining allowance) for the month. */
    public record EstimateRequest(@NotNull LocalDate asOf,
            @NotNull @DecimalMin("0.00") @Digits(integer = 15, fraction = 2) BigDecimal basicWages,
            @NotNull @DecimalMin("0.00") @Digits(integer = 15, fraction = 2) BigDecimal grossWages) {}

    public enum EstimateStatus { ESTIMATED, NOT_APPLICABLE, NEEDS_DECISION, ABOVE_CEILING, UNAVAILABLE }

    public enum Party { EMPLOYEE, EMPLOYER }

    public record EstimateLine(String scheme, String label, Party party, BigDecimal amount, EstimateStatus status, String note) {}

    public record RuleSource(String scheme, LocalDate effectiveFrom, LocalDate effectiveTo, String reference, String url, String reviewStatus) {}

    public record EstimateResponse(String employeeCode, LocalDate asOf, String currency, BigDecimal pfWages, BigDecimal esiWages,
            BigDecimal employeeDeductionTotal, BigDecimal employerContributionTotal,
            List<EstimateLine> lines, List<RuleSource> sources, List<String> warnings) {}
}
