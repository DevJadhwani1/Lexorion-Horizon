package com.lexorion.platform.security;

import com.lexorion.platform.membership.entity.OrganizationRole;
import com.lexorion.platform.organization.entity.OrganizationStatus;

public record OrganizationAuthority(OrganizationRole role, OrganizationStatus status) {
}
