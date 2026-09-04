package com.lexorion.platform.organization.dto;

import com.lexorion.platform.organization.entity.Organization;
import com.lexorion.platform.organization.entity.OrganizationStatus;
import java.time.Instant;
import java.util.UUID;

public record OrganizationResponse(UUID id, String name, String legalName, String organizationCode, String slug, String primaryEmail, String primaryPhone, OrganizationStatus status, Instant trialStartedAt, Instant trialEndsAt, Instant activatedAt, Instant suspendedAt, Instant cancelledAt, Instant createdAt, Instant updatedAt) {
   public static OrganizationResponse from(Organization organization) {
      return new OrganizationResponse(organization.getId(), organization.getName(), organization.getLegalName(), organization.getOrganizationCode(), organization.getSlug(), organization.getPrimaryEmail(), organization.getPrimaryPhone(), organization.getStatus(), organization.getTrialStartedAt(), organization.getTrialEndsAt(), organization.getActivatedAt(), organization.getSuspendedAt(), organization.getCancelledAt(), organization.getCreatedAt(), organization.getUpdatedAt());
   }
}
