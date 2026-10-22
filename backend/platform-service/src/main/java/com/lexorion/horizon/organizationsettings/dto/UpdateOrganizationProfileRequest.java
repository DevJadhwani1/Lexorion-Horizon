package com.lexorion.horizon.organizationsettings.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Null;
import jakarta.validation.constraints.Size;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

public class UpdateOrganizationProfileRequest {
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final Pattern COMPANY_SIZE_PATTERN = Pattern.compile("^(MICRO|SMALL|MEDIUM|LARGE|ENTERPRISE)$");
    private static final Pattern COUNTRY_CODE_PATTERN = Pattern.compile("^[A-Za-z]{2}$");

    @Size(max = 150)
    private String name;

    @Size(max = 255)
    private String legalName;

    @Size(max = 1000)
    private String description;

    @Size(max = 100)
    private String industry;

    private String companySize;

    @Size(max = 255)
    private String website;

    @Size(max = 255)
    private String primaryEmail;

    @Size(max = 40)
    private String primaryPhone;

    @Size(max = 255)
    private String addressLine1;

    @Size(max = 255)
    private String addressLine2;

    private String addressCountry;

    @Size(max = 100)
    private String stateProvince;

    @Size(max = 100)
    private String city;

    @Size(max = 20)
    private String postalCode;

    @Null(message = "organizationId is not accepted; tenant context determines the organization")
    private UUID organizationId;

    @Null(message = "userId is not accepted")
    private UUID userId;

    @JsonIgnore
    private final Set<String> presentFields = new HashSet<>();

    public UpdateOrganizationProfileRequest() {}

    public UpdateOrganizationProfileRequest(
        String name,
        String legalName,
        String description,
        String industry,
        String companySize,
        String website,
        String primaryEmail,
        String primaryPhone,
        String addressLine1,
        String addressLine2,
        String addressCountry,
        String stateProvince,
        String city,
        String postalCode,
        UUID organizationId,
        UUID userId
    ) {
        if (name != null) setName(name);
        if (legalName != null) setLegalName(legalName);
        if (description != null) setDescription(description);
        if (industry != null) setIndustry(industry);
        if (companySize != null) setCompanySize(companySize);
        if (website != null) setWebsite(website);
        if (primaryEmail != null) setPrimaryEmail(primaryEmail);
        if (primaryPhone != null) setPrimaryPhone(primaryPhone);
        if (addressLine1 != null) setAddressLine1(addressLine1);
        if (addressLine2 != null) setAddressLine2(addressLine2);
        if (addressCountry != null) setAddressCountry(addressCountry);
        if (stateProvince != null) setStateProvince(stateProvince);
        if (city != null) setCity(city);
        if (postalCode != null) setPostalCode(postalCode);
        if (organizationId != null) setOrganizationId(organizationId);
        if (userId != null) setUserId(userId);
    }

    public UpdateOrganizationProfileRequest(
        String name,
        String legalName,
        String description,
        String industry,
        String companySize,
        String website,
        String primaryEmail,
        String primaryPhone,
        String addressLine1,
        String addressLine2,
        String addressCountry,
        String stateProvince,
        String city,
        String postalCode,
        UUID organizationId,
        UUID userId,
        Set<String> explicitPresentFields
    ) {
        this.name = name;
        this.legalName = legalName;
        this.description = description;
        this.industry = industry;
        this.companySize = companySize;
        this.website = website;
        this.primaryEmail = primaryEmail;
        this.primaryPhone = primaryPhone;
        this.addressLine1 = addressLine1;
        this.addressLine2 = addressLine2;
        this.addressCountry = addressCountry;
        this.stateProvince = stateProvince;
        this.city = city;
        this.postalCode = postalCode;
        this.organizationId = organizationId;
        this.userId = userId;
        if (explicitPresentFields != null) {
            this.presentFields.addAll(explicitPresentFields);
        }
    }

    // Record-style accessors
    public String name() { return this.name; }
    public String legalName() { return this.legalName; }
    public String description() { return this.description; }
    public String industry() { return this.industry; }
    public String companySize() { return this.companySize; }
    public String website() { return this.website; }
    public String primaryEmail() { return this.primaryEmail; }
    public String primaryPhone() { return this.primaryPhone; }
    public String addressLine1() { return this.addressLine1; }
    public String addressLine2() { return this.addressLine2; }
    public String addressCountry() { return this.addressCountry; }
    public String stateProvince() { return this.stateProvince; }
    public String city() { return this.city; }
    public String postalCode() { return this.postalCode; }
    public UUID organizationId() { return this.organizationId; }
    public UUID userId() { return this.userId; }

    @JsonIgnore
    public Set<String> presentFields() {
        return Collections.unmodifiableSet(this.presentFields);
    }

    public boolean has(String field) {
        return this.presentFields.contains(field);
    }

    @JsonProperty("name")
    public void setName(String name) {
        this.name = name;
        this.presentFields.add("name");
    }

    @JsonProperty("legalName")
    public void setLegalName(String legalName) {
        this.legalName = legalName;
        this.presentFields.add("legalName");
    }

    @JsonProperty("description")
    public void setDescription(String description) {
        this.description = description;
        this.presentFields.add("description");
    }

    @JsonProperty("industry")
    public void setIndustry(String industry) {
        this.industry = industry;
        this.presentFields.add("industry");
    }

    @JsonProperty("companySize")
    public void setCompanySize(String companySize) {
        this.companySize = companySize;
        this.presentFields.add("companySize");
    }

    @JsonProperty("website")
    public void setWebsite(String website) {
        this.website = website;
        this.presentFields.add("website");
    }

    @JsonProperty("primaryEmail")
    public void setPrimaryEmail(String primaryEmail) {
        this.primaryEmail = primaryEmail;
        this.presentFields.add("primaryEmail");
    }

    @JsonProperty("primaryPhone")
    public void setPrimaryPhone(String primaryPhone) {
        this.primaryPhone = primaryPhone;
        this.presentFields.add("primaryPhone");
    }

    @JsonProperty("addressLine1")
    public void setAddressLine1(String addressLine1) {
        this.addressLine1 = addressLine1;
        this.presentFields.add("addressLine1");
    }

    @JsonProperty("addressLine2")
    public void setAddressLine2(String addressLine2) {
        this.addressLine2 = addressLine2;
        this.presentFields.add("addressLine2");
    }

    @JsonProperty("addressCountry")
    public void setAddressCountry(String addressCountry) {
        this.addressCountry = addressCountry;
        this.presentFields.add("addressCountry");
    }

    @JsonProperty("stateProvince")
    public void setStateProvince(String stateProvince) {
        this.stateProvince = stateProvince;
        this.presentFields.add("stateProvince");
    }

    @JsonProperty("city")
    public void setCity(String city) {
        this.city = city;
        this.presentFields.add("city");
    }

    @JsonProperty("postalCode")
    public void setPostalCode(String postalCode) {
        this.postalCode = postalCode;
        this.presentFields.add("postalCode");
    }

    @JsonProperty("organizationId")
    public void setOrganizationId(UUID organizationId) {
        this.organizationId = organizationId;
        this.presentFields.add("organizationId");
    }

    @JsonProperty("userId")
    public void setUserId(UUID userId) {
        this.userId = userId;
        this.presentFields.add("userId");
    }

    @AssertTrue(message = "name must not be blank")
    public boolean isNameValid() {
        if (!has("name")) {
            return true;
        }
        return this.name != null && !this.name.trim().isEmpty();
    }

    @AssertTrue(message = "primaryEmail must be a valid non-blank email address")
    public boolean isPrimaryEmailValid() {
        if (!has("primaryEmail")) {
            return true;
        }
        if (this.primaryEmail == null || this.primaryEmail.trim().isEmpty()) {
            return false;
        }
        return EMAIL_PATTERN.matcher(this.primaryEmail.trim()).matches();
    }

    @AssertTrue(message = "companySize must be one of: MICRO, SMALL, MEDIUM, LARGE, ENTERPRISE")
    public boolean isCompanySizeValid() {
        if (!has("companySize") || this.companySize == null || this.companySize.trim().isEmpty()) {
            return true;
        }
        return COMPANY_SIZE_PATTERN.matcher(this.companySize.trim().toUpperCase()).matches();
    }

    @AssertTrue(message = "addressCountry must be a 2-letter ISO 3166-1 alpha-2 code")
    public boolean isAddressCountryValid() {
        if (!has("addressCountry") || this.addressCountry == null || this.addressCountry.trim().isEmpty()) {
            return true;
        }
        return COUNTRY_CODE_PATTERN.matcher(this.addressCountry.trim()).matches();
    }

    @Override
    public String toString() {
        return "UpdateOrganizationProfileRequest{" +
            "name='" + name + '\'' +
            ", legalName='" + legalName + '\'' +
            ", description='" + description + '\'' +
            ", industry='" + industry + '\'' +
            ", companySize='" + companySize + '\'' +
            ", website='" + website + '\'' +
            ", primaryEmail='" + primaryEmail + '\'' +
            ", primaryPhone='" + primaryPhone + '\'' +
            ", addressLine1='" + addressLine1 + '\'' +
            ", addressLine2='" + addressLine2 + '\'' +
            ", addressCountry='" + addressCountry + '\'' +
            ", stateProvince='" + stateProvince + '\'' +
            ", city='" + city + '\'' +
            ", postalCode='" + postalCode + '\'' +
            ", organizationId=" + organizationId +
            ", userId=" + userId +
            ", presentFields=" + presentFields +
            '}';
    }
}
