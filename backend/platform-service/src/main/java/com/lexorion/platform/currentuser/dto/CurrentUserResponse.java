package com.lexorion.platform.currentuser.dto;

import java.util.UUID;

public record CurrentUserResponse(UUID id, String email, String firstName, String lastName, boolean active, CurrentPlatformAccessResponse platformAccess) {
}
