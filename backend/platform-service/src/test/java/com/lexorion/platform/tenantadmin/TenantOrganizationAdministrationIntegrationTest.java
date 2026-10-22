package com.lexorion.platform.tenantadmin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.lexorion.core.organization.entity.Organization;
import com.lexorion.core.organization.entity.OrganizationStatus;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.core.user.entity.User;
import com.lexorion.core.user.entity.UserStatus;
import com.lexorion.core.user.repository.UserRepository;
import com.lexorion.horizon.membership.entity.MembershipStatus;
import com.lexorion.horizon.membership.entity.OrganizationMembership;
import com.lexorion.horizon.membership.entity.OrganizationRole;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import com.lexorion.horizon.organizationsettings.repository.OrganizationSettingsRepository;
import com.lexorion.horizon.workspace.service.HorizonProvisioningService;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class TenantOrganizationAdministrationIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired OrganizationRepository organizations;
    @Autowired OrganizationMembershipRepository memberships;
    @Autowired OrganizationSettingsRepository settingsRepo;
    @Autowired HorizonProvisioningService horizon;
    @Autowired PasswordEncoder encoder;

    private Organization org;
    private String adminToken;

    @BeforeEach
    void setup() throws Exception {
        org = new Organization();
        org.setName("Acme International");
        org.setLegalName("Acme International Corp");
        org.setSlug("acme-intl");
        org.setOrganizationCode("ACME-INTL");
        org.setPrimaryEmail("admin@acme-intl.test");
        org.setStatus(OrganizationStatus.ACTIVE);
        org = organizations.saveAndFlush(org);
        horizon.enroll(org.getId());

        User adminUser = new User();
        adminUser.setEmail("admin@acme-intl.test");
        adminUser.setFirstName("Admin");
        adminUser.setLastName("User");
        adminUser.setPasswordHash(encoder.encode("correct-password"));
        adminUser.setStatus(UserStatus.ACTIVE);
        adminUser = users.saveAndFlush(adminUser);

        OrganizationMembership member = new OrganizationMembership();
        member.setOrganization(org);
        member.setUser(adminUser);
        member.setRole(OrganizationRole.ADMIN);
        member.setStatus(MembershipStatus.ACTIVE);
        member.setJoinedAt(Instant.now());
        memberships.saveAndFlush(member);

        adminToken = JsonPath.read(
            mvc.perform(post("/api/core/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"admin@acme-intl.test\",\"password\":\"correct-password\"}"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString(),
            "$.accessToken"
        );
    }

    private ResultActions tenant(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder req) throws Exception {
        return mvc.perform(req
            .header("Host", "localhost")
            .header("Authorization", "Bearer " + adminToken)
            .header("X-Lexorion-Organization", org.getSlug()));
    }

    @Test
    void getOrganizationReturnsProfileAndDefaultSettingsWithDateFormat() throws Exception {
        tenant(get("/api/tenant/organization"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Acme International"))
            .andExpect(jsonPath("$.legalName").value("Acme International Corp"))
            .andExpect(jsonPath("$.settings.dateFormat").value("YYYY-MM-DD"))
            .andExpect(jsonPath("$.settings.timeZone").value("UTC"))
            .andExpect(jsonPath("$.settings.currency").value("USD"))
            .andExpect(jsonPath("$.settings.country").value("US"));
    }

    @Test
    void updateProfileValidatesAndNormalizesWebsiteAndPreservesFields() throws Exception {
        tenant(patch("/api/tenant/organization")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                    "website": "https://example.com/about",
                    "primaryPhone": "+919876543210",
                    "industry": "Information technology and software",
                    "addressCountry": "IN",
                    "stateProvince": "Karnataka",
                    "city": "Bengaluru",
                    "postalCode": "560001"
                }
            """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.website").value("https://example.com/about"))
            .andExpect(jsonPath("$.primaryPhone").value("+919876543210"))
            .andExpect(jsonPath("$.industry").value("Information technology and software"))
            .andExpect(jsonPath("$.addressCountry").value("IN"))
            .andExpect(jsonPath("$.stateProvince").value("Karnataka"))
            .andExpect(jsonPath("$.city").value("Bengaluru"))
            .andExpect(jsonPath("$.postalCode").value("560001"));

        // Reject invalid website scheme like javascript: or data:
        tenant(patch("/api/tenant/organization")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"website\":\"javascript:alert(1)\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void updateSettingsPersistsDateFormatTimeZoneCountryAndCurrency() throws Exception {
        tenant(patch("/api/tenant/organization/settings")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                    "timeZone": "Asia/Kolkata",
                    "country": "IN",
                    "currency": "INR",
                    "dateFormat": "DD/MM/YYYY"
                }
            """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.settings.timeZone").value("Asia/Kolkata"))
            .andExpect(jsonPath("$.settings.country").value("IN"))
            .andExpect(jsonPath("$.settings.currency").value("INR"))
            .andExpect(jsonPath("$.settings.dateFormat").value("DD/MM/YYYY"));

        // Verify it persists on subsequent get
        tenant(get("/api/tenant/organization"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.settings.timeZone").value("Asia/Kolkata"))
            .andExpect(jsonPath("$.settings.country").value("IN"))
            .andExpect(jsonPath("$.settings.currency").value("INR"))
            .andExpect(jsonPath("$.settings.dateFormat").value("DD/MM/YYYY"));

        // Reject invalid date format
        tenant(patch("/api/tenant/organization/settings")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"dateFormat\":\"INVALID_FORMAT\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void omittedOptionalFieldRemainsUnchanged() throws Exception {
        tenant(patch("/api/tenant/organization")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                    "legalName": "Acme Legal Entity",
                    "city": "Bengaluru",
                    "website": "https://example.com"
                }
            """))
            .andExpect(status().isOk());

        // Update ONLY name, omitting legalName, city, and website
        tenant(patch("/api/tenant/organization")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Acme Brand Renamed\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Acme Brand Renamed"))
            .andExpect(jsonPath("$.legalName").value("Acme Legal Entity"))
            .andExpect(jsonPath("$.city").value("Bengaluru"))
            .andExpect(jsonPath("$.website").value("https://example.com"));
    }

    @Test
    void explicitlyClearedOptionalFieldIsPersistedAsNull() throws Exception {
        // First populate fields
        tenant(patch("/api/tenant/organization")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                    "legalName": "To Be Cleared",
                    "city": "Bengaluru",
                    "website": "https://example.com",
                    "primaryPhone": "+919876543210",
                    "addressCountry": "IN"
                }
            """))
            .andExpect(status().isOk());

        // Clear legalName with null, city with empty string, website with null, primaryPhone with empty string, addressCountry with null
        tenant(patch("/api/tenant/organization")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                    "legalName": null,
                    "city": "",
                    "website": null,
                    "primaryPhone": "",
                    "addressCountry": null
                }
            """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.legalName").isEmpty())
            .andExpect(jsonPath("$.city").isEmpty())
            .andExpect(jsonPath("$.website").isEmpty())
            .andExpect(jsonPath("$.primaryPhone").isEmpty())
            .andExpect(jsonPath("$.addressCountry").isEmpty());

        // Fresh GET to confirm persistence
        tenant(get("/api/tenant/organization"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.legalName").isEmpty())
            .andExpect(jsonPath("$.city").isEmpty())
            .andExpect(jsonPath("$.website").isEmpty())
            .andExpect(jsonPath("$.primaryPhone").isEmpty())
            .andExpect(jsonPath("$.addressCountry").isEmpty());
    }

    @Test
    void requiredPrimaryEmailCannotBeBlankOrNull() throws Exception {
        tenant(patch("/api/tenant/organization")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"primaryEmail\":\"\"}"))
            .andExpect(status().isBadRequest());

        tenant(patch("/api/tenant/organization")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"primaryEmail\":\"   \"}"))
            .andExpect(status().isBadRequest());

        tenant(patch("/api/tenant/organization")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"primaryEmail\":null}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void invalidEmailIsRejected() throws Exception {
        tenant(patch("/api/tenant/organization")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"primaryEmail\":\"not-an-email\"}"))
            .andExpect(status().isBadRequest());

        tenant(patch("/api/tenant/organization")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"primaryEmail\":\"missingdomain@\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void validUpdatesPersistAndAreReturnedByFreshGet() throws Exception {
        tenant(patch("/api/tenant/organization")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                    "name": "Lexorion Updated",
                    "legalName": "Lexorion Technologies Pvt Ltd",
                    "primaryEmail": "contact@lexorion.test",
                    "industry": "Enterprise Software & SaaS",
                    "addressCountry": "US",
                    "city": "San Francisco"
                }
            """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Lexorion Updated"))
            .andExpect(jsonPath("$.legalName").value("Lexorion Technologies Pvt Ltd"))
            .andExpect(jsonPath("$.primaryEmail").value("contact@lexorion.test"))
            .andExpect(jsonPath("$.industry").value("Enterprise Software & SaaS"))
            .andExpect(jsonPath("$.addressCountry").value("US"))
            .andExpect(jsonPath("$.city").value("San Francisco"));

        // Fresh GET
        tenant(get("/api/tenant/organization"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Lexorion Updated"))
            .andExpect(jsonPath("$.legalName").value("Lexorion Technologies Pvt Ltd"))
            .andExpect(jsonPath("$.primaryEmail").value("contact@lexorion.test"))
            .andExpect(jsonPath("$.industry").value("Enterprise Software & SaaS"))
            .andExpect(jsonPath("$.addressCountry").value("US"))
            .andExpect(jsonPath("$.city").value("San Francisco"));
    }

    @Test
    void authorizationAndTenantIsolationRemainEnforced() throws Exception {
        // Request without token fails with 401
        mvc.perform(patch("/api/tenant/organization")
            .contentType(MediaType.APPLICATION_JSON)
            .header("X-Lexorion-Organization", org.getSlug())
            .content("{\"name\":\"Hacked Name\"}"))
            .andExpect(status().isUnauthorized());

        // Client trying to inject organizationId or userId fails with 400
        tenant(patch("/api/tenant/organization")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Test\",\"organizationId\":\"00000000-0000-0000-0000-000000000000\"}"))
            .andExpect(status().isBadRequest());

        tenant(patch("/api/tenant/organization")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Test\",\"userId\":\"00000000-0000-0000-0000-000000000000\"}"))
            .andExpect(status().isBadRequest());
    }
}
