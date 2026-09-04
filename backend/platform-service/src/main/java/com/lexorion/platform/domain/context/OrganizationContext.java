package com.lexorion.platform.domain.context;

import com.lexorion.platform.domain.entity.DomainAccessMode;
import com.lexorion.platform.domain.entity.DomainType;
import com.lexorion.platform.organization.entity.OrganizationStatus;
import java.util.UUID;

public record OrganizationContext(UUID organizationId, String organizationSlug, OrganizationStatus organizationStatus, String hostname, OrganizationContextMode mode, DomainType domainType, DomainAccessMode accessMode) {
}
