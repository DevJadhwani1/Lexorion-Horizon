package com.lexorion.payroll.api;

import com.lexorion.payroll.domain.PayRunStatus;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.*;

public final class PayRunPreparationDtos {
    private PayRunPreparationDtos() {}
    public record Selection(@NotNull List<@NotBlank String> employeeCodes,
            @Null UUID workspaceId, @Null UUID organizationId, @Null UUID userId, @Null String role) {}
    public record Employee(String employeeCode, boolean selected, boolean eligible, String blockedReason) {}
    public record Preparation(String payRunKey, PayRunStatus status, LocalDate periodStart, LocalDate periodEnd,
            LocalDate calculationDate, String currency, int employeeCount, long eligibleCount, long blockedCount,
            int selectedCount, long selectedBlockedCount, boolean ready, List<String> issues, List<Employee> employees) {}
}
