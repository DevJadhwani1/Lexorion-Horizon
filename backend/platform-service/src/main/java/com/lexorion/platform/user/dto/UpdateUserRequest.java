package com.lexorion.platform.user.dto;

import com.lexorion.platform.user.entity.UserStatus;
import jakarta.validation.constraints.Size;

public record UpdateUserRequest(@Size(
   max = 100
) String firstName, @Size(
   max = 100
) String lastName, UserStatus status) {
}
