package com.lexorion.payroll.api;

import com.lexorion.payroll.domain.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Instant;
import java.util.List;

public final class SalaryTemplateVersionDtos {
    private SalaryTemplateVersionDtos() {}
    public record VersionComponentRequest(@NotBlank String componentKey,
            @NotNull @DecimalMin("0.0000") @Digits(integer = 15, fraction = 4) BigDecimal value,
            @Size(max = 64) String percentageBasis, @Min(0) Integer displaySequence) {}
    public record CreateVersion(@NotBlank @Pattern(regexp = "^[A-Z]{3}$") String currency,
            @NotNull PayFrequency payFrequency, @NotNull LocalDate effectiveFrom, LocalDate effectiveTo,
            @NotNull SalaryTemplateVersionStatus status,
            @NotEmpty List<@Valid VersionComponentRequest> components) {}
    public record UpdateVersion(@Pattern(regexp = "^[A-Z]{3}$") String currency,
            PayFrequency payFrequency, LocalDate effectiveFrom, LocalDate effectiveTo,
            SalaryTemplateVersionStatus status, List<@Valid VersionComponentRequest> components) {}
    public record VersionComponentResponse(String componentKey, String displayName, ComponentCategory category,
            AmountType amountType, OccurrenceType occurrenceType, Taxability taxability,
            BigDecimal value, String percentageBasis, int displaySequence) {}
    public record VersionResponse(String templateKey, int versionNumber, String currency,
            PayFrequency payFrequency, SalaryTemplateVersionStatus status, LocalDate effectiveFrom,
            LocalDate effectiveTo, List<VersionComponentResponse> components, Instant createdAt, Instant updatedAt) {}
}
