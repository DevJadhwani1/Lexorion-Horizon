package com.lexorion.platform.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.lexorion.core.auth.repository.RefreshTokenRepository;
import com.lexorion.platform.domain.entity.DomainAccessMode;
import com.lexorion.platform.domain.entity.DomainType;
import com.lexorion.platform.domain.entity.DomainVerificationStatus;
import com.lexorion.platform.domain.entity.OrganizationDomain;
import com.lexorion.platform.domain.repository.OrganizationDomainRepository;
import com.lexorion.horizon.invitation.repository.OrganizationInvitationRepository;
import com.lexorion.horizon.entitlement.entity.AssignmentStatus;
import com.lexorion.horizon.entitlement.entity.OrganizationPlanAssignment;
import com.lexorion.horizon.entitlement.repository.OrganizationPlanAssignmentRepository;
import com.lexorion.horizon.entitlement.repository.PlanRepository;
import com.lexorion.horizon.membership.entity.MembershipStatus;
import com.lexorion.horizon.membership.entity.OrganizationMembership;
import com.lexorion.horizon.membership.entity.OrganizationRole;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import com.lexorion.core.organization.entity.Organization;
import com.lexorion.core.organization.entity.OrganizationStatus;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.horizon.organizationsettings.repository.OrganizationSettingsRepository;
import com.lexorion.core.platformaccess.entity.PlatformAccess;
import com.lexorion.core.platformaccess.entity.PlatformAccessStatus;
import com.lexorion.core.platformaccess.entity.PlatformRole;
import com.lexorion.core.platformaccess.repository.PlatformAccessRepository;
import com.lexorion.horizon.product.entity.Product;
import com.lexorion.horizon.product.entity.ProductStatus;
import com.lexorion.horizon.product.repository.ProductRepository;
import com.lexorion.core.user.entity.User;
import com.lexorion.core.user.entity.UserStatus;
import com.lexorion.core.user.repository.UserRepository;
import com.lexorion.horizon.workspace.entity.OrganizationWorkspace;
import com.lexorion.horizon.workspace.entity.WorkspaceStatus;
import com.lexorion.horizon.workspace.repository.OrganizationWorkspaceRepository;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
class WorkspaceSecurityIntegrationTest {
    private static final String HOST = "horizon.lexorion.in";
    private static final String PASSWORD = "correct-password";
    @Autowired MockMvc mockMvc; @Autowired UserRepository users; @Autowired OrganizationRepository organizations;
    @Autowired OrganizationMembershipRepository memberships; @Autowired OrganizationWorkspaceRepository workspaces;
    @Autowired ProductRepository products; @Autowired OrganizationSettingsRepository settings;
    @Autowired OrganizationPlanAssignmentRepository planAssignments; @Autowired PlanRepository plans;
    @Autowired OrganizationInvitationRepository invitations; @Autowired OrganizationDomainRepository domains;
    @Autowired PlatformAccessRepository platformAccess; @Autowired RefreshTokenRepository refreshTokens;
    @Autowired com.lexorion.horizon.workspace.service.HorizonProvisioningService horizon;
    @Autowired com.lexorion.core.product.ProductAccessRepository coreGrants;
    @Autowired PasswordEncoder passwordEncoder;
    private Organization alpha; private Organization beta;
    private User owner; private User admin; private User manager; private User member;

    @BeforeEach void setUp() {
        cleanTenantData(); resetProducts();
        alpha = organization("Alpha", "alpha", OrganizationStatus.ACTIVE);
        beta = organization("Beta", "beta", OrganizationStatus.TRIAL);
        owner = user("owner@alpha.test"); admin = user("admin@alpha.test");
        manager = user("manager@alpha.test"); member = user("member@alpha.test");
        membership(alpha, owner, OrganizationRole.ADMIN, MembershipStatus.ACTIVE);
        membership(alpha, admin, OrganizationRole.ADMIN, MembershipStatus.ACTIVE);
        membership(alpha, manager, OrganizationRole.MANAGER, MembershipStatus.ACTIVE);
        membership(alpha, member, OrganizationRole.EMPLOYEE, MembershipStatus.ACTIVE);
        assign(alpha, "workforce", "workforce-starter");
    }
    @AfterEach void tearDown() { cleanTenantData(); resetProducts(); }

    @Test
    void activeCatalogUsesStableKeysAndDoesNotLeakIds() throws Exception {
        tenant(get("/api/platform/products"), token(owner), "alpha", HOST).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].key").isNotEmpty()).andExpect(jsonPath("$[0].id").doesNotExist())
                .andExpect(jsonPath("$[0].status").value("ACTIVE"));
        assertThat(products.findAll()).extracting(Product::getKey)
                .contains("horizon", "workforce", "payroll", "finance");
    }

    @Test
    void platformOperatorCanReadProductCatalogWithoutOrganizationContext() throws Exception {
        User platform = user("catalog-platform@example.com");
        PlatformAccess access = new PlatformAccess();
        access.setUser(platform); access.setRole(PlatformRole.SUPER_ADMIN); access.setStatus(PlatformAccessStatus.ACTIVE);
        access.setGrantedAt(Instant.now()); platformAccess.saveAndFlush(access);

        mockMvc.perform(get("/api/platform/products").header("Host", HOST)
                .header("Authorization", "Bearer " + token(platform)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].key").isNotEmpty());
    }

    @Test
    void tenantCannotMutateProductCatalog() throws Exception {
        tenant(post("/api/platform/products").contentType(MediaType.APPLICATION_JSON).content("{}"), token(owner), "alpha", HOST)
                .andExpect(status().isMethodNotAllowed());
        tenant(patch("/api/platform/products/workforce").contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"INACTIVE\"}"), token(owner), "alpha", HOST).andExpect(status().isNotFound());
        tenant(delete("/api/platform/products/workforce"), token(owner), "alpha", HOST).andExpect(status().isNotFound());
    }

    @Test
    void inactiveProductsAreNotListedProvisionedOrAccessibleButWorkspaceRemainsAdministrativelyVisible() throws Exception {
        Product workforce = product("workforce"); workforce.setStatus(ProductStatus.INACTIVE); products.saveAndFlush(workforce);
        tenant(get("/api/platform/products"), token(owner), "alpha", HOST).andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.key == 'workforce')]").isEmpty());
        create(owner, "people", "People", "workforce", "alpha").andExpect(status().isBadRequest());
        OrganizationWorkspace existing = workspace(alpha, workforce, "legacy", "Legacy");
        tenant(get("/api/tenant/workspaces"), token(owner), "alpha", HOST).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].key").value("legacy"));
        tenant(get("/api/tenant/workspaces/legacy"), token(member), "alpha", HOST).andExpect(status().isForbidden());
        assertThat(workspaces.existsById(existing.getId())).isTrue();
    }

    @Test
    void ownerAndAdminCanCreateUpdateDeactivateAndReactivate() throws Exception {
        create(owner, "core", "Core Workspace", "workforce", "alpha").andExpect(status().isCreated())
                .andExpect(jsonPath("$.organizationId").doesNotExist()).andExpect(jsonPath("$.productId").doesNotExist());
        tenant(patch("/api/tenant/workspaces/core").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"Core Operations\"}"), token(admin), "alpha", HOST)
                .andExpect(status().isOk()).andExpect(jsonPath("$.displayName").value("Core Operations"));
        tenant(delete("/api/tenant/workspaces/core"), token(admin), "alpha", HOST).andExpect(status().isNoContent());
        tenant(get("/api/tenant/workspaces/core"), token(member), "alpha", HOST).andExpect(status().isForbidden());
        tenant(patch("/api/tenant/workspaces/core").contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"ACTIVE\"}"), token(owner), "alpha", HOST).andExpect(status().isOk());
        tenant(get("/api/tenant/workspaces/core"), token(member), "alpha", HOST).andExpect(status().isOk());
    }

    @Test
    void managerMemberInactiveAndPlatformAuthorityCannotAdminister() throws Exception {
        create(manager, "one", "One", "horizon", "alpha").andExpect(status().isForbidden());
        create(member, "two", "Two", "horizon", "alpha").andExpect(status().isForbidden());
        User inactive = user("inactive@example.com"); membership(alpha, inactive, OrganizationRole.ADMIN, MembershipStatus.INACTIVE);
        create(inactive, "three", "Three", "horizon", "alpha").andExpect(status().isForbidden());
        User platform = user("platform@example.com"); PlatformAccess access = new PlatformAccess();
        access.setUser(platform); access.setRole(PlatformRole.SUPER_ADMIN); access.setStatus(PlatformAccessStatus.ACTIVE);
        access.setGrantedAt(Instant.now()); platformAccess.saveAndFlush(access);
        create(platform, "four", "Four", "horizon", "alpha").andExpect(status().isForbidden());
    }

    @Test
    void activeManagerAndMemberCanAccessButNotAdministerWorkspace() throws Exception {
        create(owner, "shared", "Shared", "workforce", "alpha").andExpect(status().isCreated());
        tenant(get("/api/tenant/workspaces/shared"), token(manager), "alpha", HOST).andExpect(status().isOk());
        tenant(get("/api/tenant/workspaces/shared"), token(member), "alpha", HOST).andExpect(status().isOk());
        tenant(get("/api/tenant/workspaces"), token(manager), "alpha", HOST).andExpect(status().isForbidden());
    }

    @Test
    void crossTenantReadsAndMutationsAreScopedByTrustedOrganization() throws Exception {
        create(owner, "alpha-only", "Alpha Only", "workforce", "alpha").andExpect(status().isCreated());
        User dual = user("dual@example.com"); membership(alpha, dual, OrganizationRole.ADMIN, MembershipStatus.ACTIVE);
        membership(beta, dual, OrganizationRole.ADMIN, MembershipStatus.ACTIVE);
        tenant(get("/api/tenant/workspaces/alpha-only"), token(dual), "beta", HOST).andExpect(status().isForbidden());
        tenant(patch("/api/tenant/workspaces/alpha-only").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"Stolen\"}"), token(dual), "beta", HOST).andExpect(status().isNotFound());
        assertThat(workspaces.findTenantWorkspace(alpha.getId(), "alpha-only")).get()
                .extracting(OrganizationWorkspace::getDisplayName).isEqualTo("Alpha Only");
    }

    @Test
    void rejectsOrganizationProductIdAndOwnershipReassignmentInjection() throws Exception {
        Product horizon = product("horizon");
        createBody(owner, "alpha", "{\"key\":\"x\",\"displayName\":\"X\",\"productKey\":\"horizon\",\"organizationId\":\""
                + beta.getId() + "\"}").andExpect(status().isBadRequest());
        createBody(owner, "alpha", "{\"key\":\"x\",\"displayName\":\"X\",\"productKey\":\"horizon\",\"productId\":\""
                + horizon.getId() + "\"}").andExpect(status().isBadRequest());
        create(owner, "fixed", "Fixed", "workforce", "alpha").andExpect(status().isCreated());
        tenant(patch("/api/tenant/workspaces/fixed").contentType(MediaType.APPLICATION_JSON)
                .content("{\"organizationId\":\"" + beta.getId() + "\",\"productKey\":\"finance\"}"),
                token(owner), "alpha", HOST).andExpect(status().isBadRequest());
    }

    @Test
    void workspaceAndProductKeysAreValidatedAndWorkspaceKeysAreTenantUnique() throws Exception {
        createBody(owner, "alpha", "{\"key\":\"Bad Key\",\"displayName\":\"Bad\",\"productKey\":\"horizon\"}")
                .andExpect(status().isBadRequest());
        create(owner, "valid", "Valid", "missing-product", "alpha").andExpect(status().isBadRequest());
        create(owner, "valid", "Valid", "workforce", "alpha").andExpect(status().isCreated());
        create(owner, "valid", "Duplicate", "finance", "alpha").andExpect(status().isConflict());
        User betaOwner = user("owner@beta.test"); membership(beta, betaOwner, OrganizationRole.ADMIN, MembershipStatus.ACTIVE);
        assign(beta, "finance", "finance-starter");
        create(betaOwner, "valid", "Beta Valid", "finance", "beta").andExpect(status().isCreated());
    }

    @Test
    void sharedHostUsesSlugArbitrarySelectionFailsAndWhiteLabelRemainsAuthoritative() throws Exception {
        request(get("/api/tenant/workspaces"), token(owner), alpha.getId().toString(), HOST).andExpect(status().isBadRequest());
        request(get("/api/tenant/workspaces"), token(owner), "beta", HOST).andExpect(status().isForbidden());
        whiteLabel(alpha, "work.alpha.example");
        request(get("/api/tenant/workspaces"), token(owner), null, "work.alpha.example").andExpect(status().isOk());
        request(get("/api/tenant/workspaces"), token(owner), "beta", "work.alpha.example").andExpect(status().isBadRequest());
    }

    @Test
    void organizationLifecycleBlocksWorkspaceAdministration() throws Exception {
        alpha.setStatus(OrganizationStatus.SUSPENDED); organizations.saveAndFlush(alpha);
        create(owner, "blocked", "Blocked", "horizon", "alpha").andExpect(status().isForbidden());
    }

    @Test
    void concurrentDuplicateCreationProducesOneWorkspace() throws Exception {
        String accessToken = token(owner);
        CompletableFuture<Integer> first = CompletableFuture.supplyAsync(() -> createStatus(accessToken));
        CompletableFuture<Integer> second = CompletableFuture.supplyAsync(() -> createStatus(accessToken));
        assertThat(List.of(first.join(), second.join())).containsExactlyInAnyOrder(201, 409);
        assertThat(workspaces.findTenantWorkspaces(alpha.getId()).stream().filter(w -> w.getKey().equals("race"))).hasSize(1);
    }

    private ResultActions create(User actor, String key, String name, String product, String slug) throws Exception {
        return createBody(actor, slug, "{\"key\":\"" + key + "\",\"displayName\":\"" + name
                + "\",\"productKey\":\"" + product + "\"}");
    }
    private ResultActions createBody(User actor, String slug, String body) throws Exception {
        return tenant(post("/api/tenant/workspaces").contentType(MediaType.APPLICATION_JSON).content(body), token(actor), slug, HOST);
    }
    private int createStatus(String token) {
        try { return tenant(post("/api/tenant/workspaces").contentType(MediaType.APPLICATION_JSON)
                .content("{\"key\":\"race\",\"displayName\":\"Race\",\"productKey\":\"workforce\"}"),
                token, "alpha", HOST).andReturn().getResponse().getStatus(); }
        catch (Exception ex) { throw new IllegalStateException(ex); }
    }
    private ResultActions tenant(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
                                 String token, String slug, String host) throws Exception {
        return request(request, token, slug, host);
    }
    private ResultActions request(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
                                  String token, String slug, String host) throws Exception {
        request.header("Host", host); if (token != null) request.header("Authorization", "Bearer " + token);
        if (slug != null) request.header("X-Lexorion-Organization", slug); return mockMvc.perform(request);
    }
    private String token(User user) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/platform/auth/login").header("Host", HOST)
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + user.getEmail()
                        + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk()).andReturn(); return JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
    }
    private Product product(String key) { return products.findByKey(key).orElseThrow(); }
    private OrganizationWorkspace workspace(Organization org, Product product, String key, String name) {
        OrganizationWorkspace value = new OrganizationWorkspace(); value.setOrganization(org); value.setProduct(product);
        value.setKey(key); value.setDisplayName(name); value.setStatus(WorkspaceStatus.ACTIVE); return workspaces.saveAndFlush(value);
    }
    private void assign(Organization org, String productKey, String planKey) {
        OrganizationPlanAssignment value = new OrganizationPlanAssignment(); value.setOrganization(org);
        value.setProduct(product(productKey)); value.setPlan(plans.findByKey(planKey).orElseThrow());
        value.setStatus(AssignmentStatus.ACTIVE); planAssignments.saveAndFlush(value);
    }
    private Organization organization(String name, String slug, OrganizationStatus status) {
        Organization value = new Organization(); value.setName(name); value.setOrganizationCode(name.toUpperCase());
        value.setSlug(slug); value.setPrimaryEmail("ops@" + slug + ".test"); value.setStatus(status);
        var saved = organizations.saveAndFlush(value); horizon.enroll(saved.getId()); return saved;
    }
    private User user(String email) {
        User value = new User(); value.setEmail(email); value.setFirstName("Test"); value.setLastName("User");
        value.setPasswordHash(passwordEncoder.encode(PASSWORD)); value.setStatus(UserStatus.ACTIVE); return users.saveAndFlush(value);
    }
    private void membership(Organization org, User user, OrganizationRole role, MembershipStatus status) {
        OrganizationMembership value = new OrganizationMembership(); value.setOrganization(org); value.setUser(user);
        value.setRole(role); value.setStatus(status); value.setJoinedAt(Instant.now()); memberships.saveAndFlush(value);
    }
    private void whiteLabel(Organization org, String host) {
        OrganizationDomain value = new OrganizationDomain(); value.setOrganization(org); value.setHostname(host);
        value.setDomainType(DomainType.CUSTOM_DOMAIN); value.setAccessMode(DomainAccessMode.WHITE_LABEL);
        value.setVerificationStatus(DomainVerificationStatus.VERIFIED); value.setActive(true); value.setPrimaryDomain(true);
        value.setVerifiedAt(Instant.now()); domains.saveAndFlush(value);
    }
    private void resetProducts() { products.findAll().forEach(p -> { p.setStatus(ProductStatus.ACTIVE); products.save(p); }); products.flush(); }
    private void cleanTenantData() {
        refreshTokens.deleteAll(); invitations.deleteAll(); workspaces.deleteAll(); planAssignments.deleteAll(); domains.deleteAll(); memberships.deleteAll();
        settings.deleteAll(); platformAccess.deleteAll(); coreGrants.deleteAll(); organizations.deleteAll(); users.deleteAll();
    }
}
