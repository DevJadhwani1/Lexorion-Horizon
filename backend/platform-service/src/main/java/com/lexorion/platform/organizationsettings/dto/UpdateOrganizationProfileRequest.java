package com.lexorion.platform.organizationsettings.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Null;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record UpdateOrganizationProfileRequest(@Size(
   max = 150
) String name, @Size(
   max = 255
) String legalName, @Size(
   max = 1000
) String description, @Size(
   max = 100
) String industry, @Pattern(
   regexp = "^(MICRO|SMALL|MEDIUM|LARGE|ENTERPRISE)$"
) String companySize, @Size(
   max = 255
) String website, @Email @Size(
   max = 255
) String primaryEmail, @Size(
   max = 40
) String primaryPhone, @Size(
   max = 255
) String addressLine1, @Size(
   max = 255
) String addressLine2, @Pattern(
   regexp = "^[A-Za-z]{2}$"
) String addressCountry, @Size(
   max = 100
) String stateProvince, @Size(
   max = 100
) String city, @Size(
   max = 20
) String postalCode, @Null(
   message = "organizationId is not accepted; tenant context determines the organization"
) UUID organizationId, @Null(
   message = "userId is not accepted"
) UUID userId) {
}
