package com.lexorion.platform.platformaccess.dto;

import com.lexorion.core.platformaccess.entity.PlatformRole;
import jakarta.validation.constraints.NotNull;

public record UpdatePlatformRoleRequest(@NotNull PlatformRole role) {
}
