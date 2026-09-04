package com.lexorion.platform.domain.dto;

import com.lexorion.platform.domain.entity.DomainAccessMode;
import com.lexorion.platform.domain.entity.DomainType;
import com.lexorion.platform.domain.entity.DomainVerificationStatus;
import com.lexorion.platform.domain.entity.OrganizationDomain;

public record OrganizationDomainResponse(String hostname, DomainType domainType, DomainAccessMode accessMode, DomainVerificationStatus verificationStatus, boolean primary, boolean active) {
   public static OrganizationDomainResponse from(OrganizationDomain domain) {
      return new OrganizationDomainResponse(domain.getHostname(), domain.getDomainType(), domain.getAccessMode(), domain.getVerificationStatus(), domain.isPrimaryDomain(), domain.isActive());
   }
}
