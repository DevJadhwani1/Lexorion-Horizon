package com.lexorion.platform;

import com.lexorion.core.product.*;
import com.lexorion.core.security.JwtService;
import com.lexorion.core.user.entity.*;
import com.lexorion.core.user.repository.UserRepository;
import com.lexorion.core.organization.entity.*;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.core.platformaccess.entity.*;
import com.lexorion.core.platformaccess.repository.PlatformAccessRepository;
import com.lexorion.horizon.membership.entity.*;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CoreFoundationIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired OrganizationRepository organizations;
    @Autowired OrganizationMembershipRepository memberships;
    @Autowired ProductAccessRepository grants;
    @Autowired CoreProductRepository products;
    @Autowired ProductAccessService access;
    @Autowired PlatformAccessRepository operators;
    @Autowired JwtService jwt;
    User user; Organization organization; ProductAccessGrant grant; OrganizationMembership membership;
    String token;

    @BeforeEach void setUp() {
        user = new User(); user.setEmail("core-" + UUID.randomUUID() + "@test.example");
        user.setFirstName("Core"); user.setLastName("Member"); user.setPasswordHash("unused"); user.setStatus(UserStatus.ACTIVE);
        users.saveAndFlush(user);
        organization = new Organization(); organization.setName("Core organization"); organization.setOrganizationCode(UUID.randomUUID().toString());
        organization.setSlug("core-" + UUID.randomUUID()); organization.setPrimaryEmail(user.getEmail()); organization.setStatus(OrganizationStatus.ACTIVE);
        organizations.saveAndFlush(organization);
        membership = new OrganizationMembership(); membership.setUser(user); membership.setOrganization(organization);
        membership.setRole(OrganizationRole.EMPLOYEE); membership.setStatus(MembershipStatus.ACTIVE); membership.setJoinedAt(Instant.now());
        memberships.saveAndFlush(membership);
        grant = new ProductAccessGrant(); grant.setOrganizationId(organization.getId()); grant.setProductKey("horizon");
        grant.setStatus(ProductAccessGrant.Status.ACTIVE); grants.saveAndFlush(grant);
        token = jwt.issue(user.getId(), user.getEmail()).value();
    }

    @Test void coreIdentityAndProductsNeedNoHorizonHostWorkspaceOrRole() throws Exception {
        mvc.perform(get("/api/core/me").header("Host", "axon.example.test").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.userId").value(user.getId().toString()))
                .andExpect(jsonPath("$.organizationIds[0]").value(organization.getId().toString()))
                .andExpect(jsonPath("$.role").doesNotExist()).andExpect(jsonPath("$.workspaces").doesNotExist());
        mvc.perform(get(productsUrl()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].productKey").value("horizon"));
        mvc.perform(get("/api/core/products").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].key").value("atlas")).andExpect(jsonPath("$[1].key").value("axon"));
    }

    @Test void grantsAreIndependentOfHorizonModulePlansAndRoles() {
        access.requireAccess(user.getId(), organization.getId(), "horizon");
        membership.setRole(OrganizationRole.MANAGER); memberships.saveAndFlush(membership);
        access.requireAccess(user.getId(), organization.getId(), "horizon");
        products.saveAndFlush(new CoreProduct("axon", "Axon", true));
        assertThatThrownBy(() -> access.requireAccess(user.getId(), organization.getId(), "axon"))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        var axon = new ProductAccessGrant(); axon.setOrganizationId(organization.getId()); axon.setProductKey("axon");
        axon.setStatus(ProductAccessGrant.Status.ACTIVE); grants.saveAndFlush(axon);
        access.requireAccess(user.getId(), organization.getId(), "axon");
        grant.setStatus(ProductAccessGrant.Status.REVOKED); grants.saveAndFlush(grant);
        access.requireAccess(user.getId(), organization.getId(), "axon");
    }

    @Test void revokingCoreAccessBlocksExistingHorizonWorkspaceEntry() throws Exception {
        mvc.perform(get("/api/tenant/workspaces/accessible").header("Host", "horizon.lexorion.in")
                .header("X-Lexorion-Organization", organization.getSlug()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        grant.setStatus(ProductAccessGrant.Status.REVOKED); grants.saveAndFlush(grant);
        mvc.perform(get("/api/tenant/workspaces/accessible").header("Host", "horizon.lexorion.in")
                .header("X-Lexorion-Organization", organization.getSlug()).header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test void membershipOrganizationProductAndGrantLifecycleAllGateEntry() {
        grant.setValidFrom(Instant.now().plusSeconds(3600)); grants.saveAndFlush(grant); denied();
        grant.setValidFrom(null); grant.setValidUntil(Instant.now().minusSeconds(1)); grants.saveAndFlush(grant); denied();
        grant.setValidUntil(null); grant.setStatus(ProductAccessGrant.Status.SUSPENDED); grants.saveAndFlush(grant); denied();
        grant.setStatus(ProductAccessGrant.Status.ACTIVE); grants.saveAndFlush(grant);
        products.saveAndFlush(new CoreProduct("horizon", "Horizon", false)); denied();
        products.saveAndFlush(new CoreProduct("horizon", "Horizon", true));
        organization.setStatus(OrganizationStatus.SUSPENDED); organizations.saveAndFlush(organization); denied();
        organization.setStatus(OrganizationStatus.ACTIVE); organizations.saveAndFlush(organization);
        membership.setStatus(MembershipStatus.INACTIVE); memberships.saveAndFlush(membership); denied();
    }

    @Test void unauthenticatedAndCrossOrganizationRequestsAreDenied() throws Exception {
        mvc.perform(get("/api/core/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/core/me/organizations/" + UUID.randomUUID() + "/products").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
        user.setStatus(UserStatus.LOCKED); users.saveAndFlush(user);
        mvc.perform(get(productsUrl()).header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }

    @Test void onlyCoreOperatorsCanManageGrantsAndOperatorStatusDoesNotBypassMembership() throws Exception {
        String url = "/api/core/organizations/" + organization.getId() + "/products/horizon";
        mvc.perform(put(url).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"REVOKED\"}")).andExpect(status().isForbidden());
        var operator = new PlatformAccess(); operator.setUser(user); operator.setRole(PlatformRole.ADMIN);
        operator.setStatus(PlatformAccessStatus.ACTIVE); operator.setGrantedAt(Instant.now()); operators.saveAndFlush(operator);
        mvc.perform(put(url).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"REVOKED\"}")).andExpect(status().isNoContent());
        assertThat(grants.findById(grant.getId()).orElseThrow().getStatus()).isEqualTo(ProductAccessGrant.Status.REVOKED);
        membership.setStatus(MembershipStatus.INACTIVE); memberships.saveAndFlush(membership);
        mvc.perform(get(productsUrl()).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }

    @Test void legacyHorizonOnboardingAddsItsRoleToTheCoreAssociation() throws Exception {
        var operator = new PlatformAccess(); operator.setUser(user); operator.setRole(PlatformRole.ADMIN);
        operator.setStatus(PlatformAccessStatus.ACTIVE); operator.setGrantedAt(Instant.now()); operators.saveAndFlush(operator);
        String response = mvc.perform(post("/api/platform/organizations").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Horizon onboarding\",\"organizationCode\":\"NEW-HORIZON\",\"primaryEmail\":\"ops@new.test\",\"ownerUserId\":\"" + user.getId() + "\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID id = UUID.fromString(com.jayway.jsonpath.JsonPath.read(response, "$.id"));
        assertThat(memberships.findByUserIdAndOrganizationIdAndStatus(user.getId(), id, MembershipStatus.ACTIVE).orElseThrow().getRole())
                .isEqualTo(OrganizationRole.ADMIN);
        assertThat(grants.findByOrganizationIdAndProductKey(id, "horizon")).isPresent();
    }

    @Test void grantValidityUsesInclusiveStartAndExclusiveEnd() {
        Instant now = Instant.parse("2026-09-06T00:00:00Z");
        grant.setValidFrom(now); grant.setValidUntil(now.plusSeconds(1));
        assertThat(grant.isValidAt(now)).isTrue();
        assertThat(grant.isValidAt(now.minusNanos(1))).isFalse();
        assertThat(grant.isValidAt(now.plusSeconds(1))).isFalse();
    }

    private String productsUrl() { return "/api/core/me/organizations/" + organization.getId() + "/products"; }
    private void denied() { assertThatThrownBy(() -> access.requireAccess(user.getId(), organization.getId(), "horizon"))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class); }
}
