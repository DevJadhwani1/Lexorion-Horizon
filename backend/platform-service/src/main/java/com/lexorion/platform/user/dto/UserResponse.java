package com.lexorion.platform.user.dto;

import com.lexorion.platform.user.entity.User;
import com.lexorion.platform.user.entity.UserStatus;
import java.time.Instant;
import java.util.UUID;

public record UserResponse(UUID id, String email, String firstName, String lastName, UserStatus status, Instant createdAt, Instant updatedAt) {
   public static UserResponse from(User user) {
      return new UserResponse(user.getId(), user.getEmail(), user.getFirstName(), user.getLastName(), user.getStatus(), user.getCreatedAt(), user.getUpdatedAt());
   }
}
