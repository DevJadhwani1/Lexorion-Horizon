package com.lexorion.platform.platformaccess.dto;

import com.lexorion.platform.platformaccess.entity.PlatformAccessStatus;
import jakarta.validation.constraints.NotNull;

public record UpdatePlatformAccessStatusRequest(@NotNull PlatformAccessStatus status) {
}
