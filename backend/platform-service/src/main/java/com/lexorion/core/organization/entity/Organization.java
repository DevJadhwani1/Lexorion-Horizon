package com.lexorion.core.organization.entity;

import com.lexorion.core.config.Auditable;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;
import lombok.Generated;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(
   name = "organizations",
   uniqueConstraints = {@UniqueConstraint(
   name = "uk_organizations_organization_code",
   columnNames = {"organization_code"}
), @UniqueConstraint(
   name = "uk_organizations_slug",
   columnNames = {"slug"}
)}
)
public class Organization extends Auditable {
   @Id
   @UuidGenerator
   @Column(
      nullable = false,
      updatable = false
   )
   private UUID id;
   @Column(
      nullable = false
   )
   private String name;
   @Column(
      name = "legal_name"
   )
   private String legalName;
   @Column(
      name = "organization_code",
      nullable = false
   )
   private String organizationCode;
   @Column(
      length = 63,
      unique = true
   )
   private String slug;
   @Column(
      name = "primary_email",
      nullable = false
   )
   private String primaryEmail;
   @Column(
      name = "primary_phone"
   )
   private String primaryPhone;
   @Column(
      length = 1000
   )
   private String description;
   @Column(
      length = 100
   )
   private String industry;
   @Column(
      name = "company_size",
      length = 30
   )
   private String companySize;
   @Column(
      length = 255
   )
   private String website;
   @Column(
      name = "address_line_1",
      length = 255
   )
   private String addressLine1;
   @Column(
      name = "address_line_2",
      length = 255
   )
   private String addressLine2;
   @Column(
      name = "address_country",
      length = 2
   )
   private String addressCountry;
   @Column(
      name = "state_province",
      length = 100
   )
   private String stateProvince;
   @Column(
      length = 100
   )
   private String city;
   @Column(
      name = "postal_code",
      length = 20
   )
   private String postalCode;
   @Enumerated(EnumType.STRING)
   @Column(
      nullable = false,
      length = 20
   )
   private OrganizationStatus status;
   @Column(
      name = "trial_started_at"
   )
   private Instant trialStartedAt;
   @Column(
      name = "trial_ends_at"
   )
   private Instant trialEndsAt;
   @Column(
      name = "activated_at"
   )
   private Instant activatedAt;
   @Column(
      name = "suspended_at"
   )
   private Instant suspendedAt;
   @Column(
      name = "cancelled_at"
   )
   private Instant cancelledAt;

   @Generated
   public UUID getId() {
      return this.id;
   }

   @Generated
   public String getName() {
      return this.name;
   }

   @Generated
   public String getLegalName() {
      return this.legalName;
   }

   @Generated
   public String getOrganizationCode() {
      return this.organizationCode;
   }

   @Generated
   public String getSlug() {
      return this.slug;
   }

   @Generated
   public String getPrimaryEmail() {
      return this.primaryEmail;
   }

   @Generated
   public String getPrimaryPhone() {
      return this.primaryPhone;
   }

   @Generated
   public String getDescription() {
      return this.description;
   }

   @Generated
   public String getIndustry() {
      return this.industry;
   }

   @Generated
   public String getCompanySize() {
      return this.companySize;
   }

   @Generated
   public String getWebsite() {
      return this.website;
   }

   @Generated
   public String getAddressLine1() {
      return this.addressLine1;
   }

   @Generated
   public String getAddressLine2() {
      return this.addressLine2;
   }

   @Generated
   public String getAddressCountry() {
      return this.addressCountry;
   }

   @Generated
   public String getStateProvince() {
      return this.stateProvince;
   }

   @Generated
   public String getCity() {
      return this.city;
   }

   @Generated
   public String getPostalCode() {
      return this.postalCode;
   }

   @Generated
   public OrganizationStatus getStatus() {
      return this.status;
   }

   @Generated
   public Instant getTrialStartedAt() {
      return this.trialStartedAt;
   }

   @Generated
   public Instant getTrialEndsAt() {
      return this.trialEndsAt;
   }

   @Generated
   public Instant getActivatedAt() {
      return this.activatedAt;
   }

   @Generated
   public Instant getSuspendedAt() {
      return this.suspendedAt;
   }

   @Generated
   public Instant getCancelledAt() {
      return this.cancelledAt;
   }

   @Generated
   public void setId(final UUID id) {
      this.id = id;
   }

   @Generated
   public void setName(final String name) {
      this.name = name;
   }

   @Generated
   public void setLegalName(final String legalName) {
      this.legalName = legalName;
   }

   @Generated
   public void setOrganizationCode(final String organizationCode) {
      this.organizationCode = organizationCode;
   }

   @Generated
   public void setSlug(final String slug) {
      this.slug = slug;
   }

   @Generated
   public void setPrimaryEmail(final String primaryEmail) {
      this.primaryEmail = primaryEmail;
   }

   @Generated
   public void setPrimaryPhone(final String primaryPhone) {
      this.primaryPhone = primaryPhone;
   }

   @Generated
   public void setDescription(final String description) {
      this.description = description;
   }

   @Generated
   public void setIndustry(final String industry) {
      this.industry = industry;
   }

   @Generated
   public void setCompanySize(final String companySize) {
      this.companySize = companySize;
   }

   @Generated
   public void setWebsite(final String website) {
      this.website = website;
   }

   @Generated
   public void setAddressLine1(final String addressLine1) {
      this.addressLine1 = addressLine1;
   }

   @Generated
   public void setAddressLine2(final String addressLine2) {
      this.addressLine2 = addressLine2;
   }

   @Generated
   public void setAddressCountry(final String addressCountry) {
      this.addressCountry = addressCountry;
   }

   @Generated
   public void setStateProvince(final String stateProvince) {
      this.stateProvince = stateProvince;
   }

   @Generated
   public void setCity(final String city) {
      this.city = city;
   }

   @Generated
   public void setPostalCode(final String postalCode) {
      this.postalCode = postalCode;
   }

   @Generated
   public void setStatus(final OrganizationStatus status) {
      this.status = status;
   }

   @Generated
   public void setTrialStartedAt(final Instant trialStartedAt) {
      this.trialStartedAt = trialStartedAt;
   }

   @Generated
   public void setTrialEndsAt(final Instant trialEndsAt) {
      this.trialEndsAt = trialEndsAt;
   }

   @Generated
   public void setActivatedAt(final Instant activatedAt) {
      this.activatedAt = activatedAt;
   }

   @Generated
   public void setSuspendedAt(final Instant suspendedAt) {
      this.suspendedAt = suspendedAt;
   }

   @Generated
   public void setCancelledAt(final Instant cancelledAt) {
      this.cancelledAt = cancelledAt;
   }

   @Generated
   public Organization() {
      this.status = OrganizationStatus.PENDING;
   }
}
