package com.lexorion.platform.platformaccess.dto;

import com.lexorion.core.platformaccess.entity.PlatformAccess;
import com.lexorion.core.platformaccess.entity.PlatformAccessStatus;
import com.lexorion.core.platformaccess.entity.PlatformRole;
import java.time.Instant;
import java.util.UUID;

public record PlatformAccessResponse(UUID id, UUID userId, String userEmail, PlatformRole role, PlatformAccessStatus status, Instant grantedAt, Instant createdAt, Instant updatedAt) {
   public static PlatformAccessResponse from(PlatformAccess access) {
      return new PlatformAccessResponse(access.getId(), access.getUser().getId(), access.getUser().getEmail(), access.getRole(), access.getStatus(), access.getGrantedAt(), access.getCreatedAt(), access.getUpdatedAt());
   }
}
