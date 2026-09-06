package com.lexorion.core.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateUserRequest(@NotBlank @Email @Size(
   max = 255
) String email, @NotBlank @Size(
   max = 100
) String firstName, @NotBlank @Size(
   max = 100
) String lastName, @NotBlank @Size(
   min = 8,
   max = 100
) String password) {
}
