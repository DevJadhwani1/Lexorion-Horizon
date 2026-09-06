package com.lexorion.horizon.organizationsettings.entity;

import com.lexorion.core.config.Auditable;
import com.lexorion.core.organization.entity.Organization;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;
import lombok.Generated;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(
   name = "organization_settings"
)
public class OrganizationSettings extends Auditable {
   @Id
   @UuidGenerator
   @Column(
      nullable = false,
      updatable = false
   )
   private UUID id;
   @OneToOne(
      fetch = FetchType.LAZY,
      optional = false
   )
   @JoinColumn(
      name = "organization_id",
      nullable = false,
      unique = true
   )
   private Organization organization;
   @Column(
      name = "time_zone",
      nullable = false,
      length = 50
   )
   private String timeZone = "UTC";
   @Column(
      nullable = false,
      length = 35
   )
   private String locale = "en-US";
   @Column(
      name = "default_country",
      nullable = false,
      length = 2
   )
   private String defaultCountry = "US";
   @Column(
      name = "default_currency",
      nullable = false,
      length = 3
   )
   private String defaultCurrency = "USD";
   @ElementCollection(
      fetch = FetchType.EAGER
   )
   @CollectionTable(
      name = "organization_working_days",
      joinColumns = {@JoinColumn(
   name = "settings_id"
)}
   )
   @Column(
      name = "working_day",
      nullable = false,
      length = 10
   )
   @Enumerated(EnumType.STRING)
   private Set<WorkingDay> workingDays;
   @Column(
      name = "branding_display_name",
      length = 150
   )
   private String brandingDisplayName;
   @Column(
      name = "logo_reference",
      length = 255
   )
   private String logoReference;
   @Column(
      name = "primary_color",
      length = 7
   )
   private String primaryColor;
   @Column(
      name = "secondary_color",
      length = 7
   )
   private String secondaryColor;

   @Generated
   public UUID getId() {
      return this.id;
   }

   @Generated
   public Organization getOrganization() {
      return this.organization;
   }

   @Generated
   public String getTimeZone() {
      return this.timeZone;
   }

   @Generated
   public String getLocale() {
      return this.locale;
   }

   @Generated
   public String getDefaultCountry() {
      return this.defaultCountry;
   }

   @Generated
   public String getDefaultCurrency() {
      return this.defaultCurrency;
   }

   @Generated
   public Set<WorkingDay> getWorkingDays() {
      return this.workingDays;
   }

   @Generated
   public String getBrandingDisplayName() {
      return this.brandingDisplayName;
   }

   @Generated
   public String getLogoReference() {
      return this.logoReference;
   }

   @Generated
   public String getPrimaryColor() {
      return this.primaryColor;
   }

   @Generated
   public String getSecondaryColor() {
      return this.secondaryColor;
   }

   @Generated
   public void setId(final UUID id) {
      this.id = id;
   }

   @Generated
   public void setOrganization(final Organization organization) {
      this.organization = organization;
   }

   @Generated
   public void setTimeZone(final String timeZone) {
      this.timeZone = timeZone;
   }

   @Generated
   public void setLocale(final String locale) {
      this.locale = locale;
   }

   @Generated
   public void setDefaultCountry(final String defaultCountry) {
      this.defaultCountry = defaultCountry;
   }

   @Generated
   public void setDefaultCurrency(final String defaultCurrency) {
      this.defaultCurrency = defaultCurrency;
   }

   @Generated
   public void setWorkingDays(final Set<WorkingDay> workingDays) {
      this.workingDays = workingDays;
   }

   @Generated
   public void setBrandingDisplayName(final String brandingDisplayName) {
      this.brandingDisplayName = brandingDisplayName;
   }

   @Generated
   public void setLogoReference(final String logoReference) {
      this.logoReference = logoReference;
   }

   @Generated
   public void setPrimaryColor(final String primaryColor) {
      this.primaryColor = primaryColor;
   }

   @Generated
   public void setSecondaryColor(final String secondaryColor) {
      this.secondaryColor = secondaryColor;
   }

   @Generated
   public OrganizationSettings() {
      this.workingDays = EnumSet.of(WorkingDay.MONDAY, WorkingDay.TUESDAY, WorkingDay.WEDNESDAY, WorkingDay.THURSDAY, WorkingDay.FRIDAY);
   }
}
