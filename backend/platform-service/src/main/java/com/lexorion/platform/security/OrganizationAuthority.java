package com.lexorion.platform.security;

import com.lexorion.horizon.membership.entity.OrganizationRole;
import com.lexorion.core.organization.entity.OrganizationStatus;

public record OrganizationAuthority(OrganizationRole role, OrganizationStatus status) {
}
