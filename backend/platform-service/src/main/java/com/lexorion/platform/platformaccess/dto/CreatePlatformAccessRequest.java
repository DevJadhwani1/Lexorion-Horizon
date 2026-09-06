package com.lexorion.platform.platformaccess.dto;

import com.lexorion.core.platformaccess.entity.PlatformRole;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreatePlatformAccessRequest(@NotNull UUID userId, @NotNull PlatformRole role) {
}
