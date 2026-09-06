package com.lexorion.horizon.organizationsettings.dto;

import com.lexorion.horizon.organizationsettings.entity.WorkingDay;
import jakarta.validation.constraints.Null;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Set;
import java.util.UUID;

public record UpdateOrganizationSettingsRequest(@Size(
   max = 50
) String timeZone, @Size(
   max = 35
) String locale, @Pattern(
   regexp = "^[A-Za-z]{2}$"
) String country, @Pattern(
   regexp = "^[A-Za-z]{3}$"
) String currency, Set<WorkingDay> workingDays, @Size(
   max = 150
) String brandingDisplayName, @Pattern(
   regexp = "^[A-Za-z0-9][A-Za-z0-9/_-]{0,254}$"
) String logoReference, @Pattern(
   regexp = "^#[0-9A-Fa-f]{6}$"
) String primaryColor, @Pattern(
   regexp = "^#[0-9A-Fa-f]{6}$"
) String secondaryColor, @Null(
   message = "organizationId is not accepted; tenant context determines the organization"
) UUID organizationId, @Null(
   message = "userId is not accepted"
) UUID userId) {
}
