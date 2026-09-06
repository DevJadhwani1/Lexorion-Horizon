package com.lexorion.platform.organization.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record UpdateOrganizationRequest(@Size(
   max = 150
) String name, @Size(
   max = 200
) String legalName, @Email @Size(
   max = 255
) String primaryEmail, @Size(
   max = 30
) String primaryPhone, @Size(max = 100) String planKey) {
}
