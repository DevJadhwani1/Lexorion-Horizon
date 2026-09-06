package com.lexorion.platform.organization.dto;

import com.lexorion.core.organization.entity.OrganizationStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateOrganizationStatusRequest(@NotNull OrganizationStatus status) {
}
