package com.lexorion.horizon.currentuser.dto;

import com.lexorion.core.platformaccess.entity.PlatformRole;

public record CurrentPlatformAccessResponse(boolean active, PlatformRole role) {
}
