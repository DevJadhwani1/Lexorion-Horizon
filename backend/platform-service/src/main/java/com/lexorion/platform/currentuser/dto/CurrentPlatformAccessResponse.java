package com.lexorion.platform.currentuser.dto;

import com.lexorion.platform.platformaccess.entity.PlatformRole;

public record CurrentPlatformAccessResponse(boolean active, PlatformRole role) {
}
