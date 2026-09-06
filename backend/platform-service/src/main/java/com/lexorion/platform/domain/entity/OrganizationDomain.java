package com.lexorion.platform.domain.entity;

import com.lexorion.core.config.Auditable;
import com.lexorion.core.organization.entity.Organization;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;
import lombok.Generated;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(
   name = "organization_domains",
   uniqueConstraints = {@UniqueConstraint(
   name = "uk_organization_domains_hostname",
   columnNames = {"hostname"}
)}
)
public class OrganizationDomain extends Auditable {
   @Id
   @UuidGenerator
   @Column(
      nullable = false,
      updatable = false
   )
   private UUID id;
   @ManyToOne(
      fetch = FetchType.LAZY,
      optional = false
   )
   @JoinColumn(
      name = "organization_id",
      nullable = false
   )
   private Organization organization;
   @Column(
      nullable = false,
      length = 253
   )
   private String hostname;
   @Enumerated(EnumType.STRING)
   @Column(
      name = "domain_type",
      nullable = false,
      length = 30
   )
   private DomainType domainType;
   @Enumerated(EnumType.STRING)
   @Column(
      name = "access_mode",
      nullable = false,
      length = 20
   )
   private DomainAccessMode accessMode;
   @Enumerated(EnumType.STRING)
   @Column(
      name = "verification_status",
      nullable = false,
      length = 20
   )
   private DomainVerificationStatus verificationStatus;
   @Column(
      name = "primary_domain",
      nullable = false
   )
   private boolean primaryDomain;
   @Column(
      nullable = false
   )
   private boolean active;
   @Column(
      name = "verified_at"
   )
   private Instant verifiedAt;

   @Generated
   public UUID getId() {
      return this.id;
   }

   @Generated
   public Organization getOrganization() {
      return this.organization;
   }

   @Generated
   public String getHostname() {
      return this.hostname;
   }

   @Generated
   public DomainType getDomainType() {
      return this.domainType;
   }

   @Generated
   public DomainAccessMode getAccessMode() {
      return this.accessMode;
   }

   @Generated
   public DomainVerificationStatus getVerificationStatus() {
      return this.verificationStatus;
   }

   @Generated
   public boolean isPrimaryDomain() {
      return this.primaryDomain;
   }

   @Generated
   public boolean isActive() {
      return this.active;
   }

   @Generated
   public Instant getVerifiedAt() {
      return this.verifiedAt;
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
   public void setHostname(final String hostname) {
      this.hostname = hostname;
   }

   @Generated
   public void setDomainType(final DomainType domainType) {
      this.domainType = domainType;
   }

   @Generated
   public void setAccessMode(final DomainAccessMode accessMode) {
      this.accessMode = accessMode;
   }

   @Generated
   public void setVerificationStatus(final DomainVerificationStatus verificationStatus) {
      this.verificationStatus = verificationStatus;
   }

   @Generated
   public void setPrimaryDomain(final boolean primaryDomain) {
      this.primaryDomain = primaryDomain;
   }

   @Generated
   public void setActive(final boolean active) {
      this.active = active;
   }

   @Generated
   public void setVerifiedAt(final Instant verifiedAt) {
      this.verifiedAt = verifiedAt;
   }
}
