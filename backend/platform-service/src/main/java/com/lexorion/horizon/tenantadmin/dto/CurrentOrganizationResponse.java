package com.lexorion.horizon.tenantadmin.dto;

import com.lexorion.core.organization.entity.Organization;
import com.lexorion.core.organization.entity.OrganizationStatus;
import com.lexorion.horizon.organizationsettings.dto.OrganizationSettingsResponse;
import com.lexorion.horizon.organizationsettings.entity.OrganizationSettings;
import java.time.Instant;

public record CurrentOrganizationResponse(String name, String legalName, String organizationCode, String slug, String primaryEmail, String primaryPhone, OrganizationStatus status, Instant trialEndsAt, String description, String industry, String companySize, String website, String addressLine1, String addressLine2, String addressCountry, String stateProvince, String city, String postalCode, OrganizationSettingsResponse settings) {
   public static CurrentOrganizationResponse from(Organization organization, OrganizationSettings settings) {
      return new CurrentOrganizationResponse(organization.getName(), organization.getLegalName(), organization.getOrganizationCode(), organization.getSlug(), organization.getPrimaryEmail(), organization.getPrimaryPhone(), organization.getStatus(), organization.getTrialEndsAt(), organization.getDescription(), organization.getIndustry(), organization.getCompanySize(), organization.getWebsite(), organization.getAddressLine1(), organization.getAddressLine2(), organization.getAddressCountry(), organization.getStateProvince(), organization.getCity(), organization.getPostalCode(), OrganizationSettingsResponse.from(settings));
   }
}
