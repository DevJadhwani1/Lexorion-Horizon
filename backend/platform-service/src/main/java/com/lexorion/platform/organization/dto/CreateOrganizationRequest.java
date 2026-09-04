package com.lexorion.platform.organization.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateOrganizationRequest(@NotBlank @Size(
   max = 150
) String name, @Size(
   max = 200
) String legalName, @NotBlank @Size(
   max = 50
) String organizationCode, @Size(
   max = 100
) String slug, @NotBlank @Email @Size(
   max = 255
) String primaryEmail, @Size(
   max = 30
) String primaryPhone, @NotNull UUID ownerUserId) {
}
