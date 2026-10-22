package com.lexorion.horizon.currentuser.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** A null workspace key records the organization only and keeps that organization's remembered workspace. */
public record UpdateLastUsedContextRequest(@NotBlank @Size(max = 255) String organizationSlug, @Size(max = 63) String workspaceKey) {
}
