package com.lexorion.platform.invitation.dto;

import com.lexorion.platform.membership.entity.OrganizationRole;
import com.lexorion.platform.user.service.UserService;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Null;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateInvitationRequest(@NotBlank @Email @Size(
   max = 255
) String email, @NotNull OrganizationRole role, @Null(
   message = "organizationId is not accepted; tenant context determines the organization"
) UUID organizationId) {
   public CreateInvitationRequest(@NotBlank @Email @Size(
   max = 255
) String email, @NotNull OrganizationRole role, @Null(
   message = "organizationId is not accepted; tenant context determines the organization"
) UUID organizationId) {
      email = UserService.normalizeEmail(email);
      this.email = email;
      this.role = role;
      this.organizationId = organizationId;
   }
}
