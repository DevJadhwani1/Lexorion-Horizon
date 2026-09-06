package com.lexorion.platform.entitlement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import com.lexorion.core.auth.repository.RefreshTokenRepository;
import com.lexorion.platform.domain.entity.*;
import com.lexorion.platform.domain.repository.OrganizationDomainRepository;
import com.lexorion.horizon.entitlement.entity.*;
import com.lexorion.horizon.entitlement.repository.*;
import com.lexorion.horizon.entitlement.exception.*;
import com.lexorion.horizon.entitlement.service.EntitlementService;
import com.lexorion.horizon.invitation.repository.OrganizationInvitationRepository;
import com.lexorion.horizon.membership.entity.*;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import com.lexorion.core.organization.entity.*;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.horizon.organizationsettings.repository.OrganizationSettingsRepository;
import com.lexorion.core.platformaccess.entity.*;
import com.lexorion.core.platformaccess.repository.PlatformAccessRepository;
import com.lexorion.horizon.product.entity.*;
import com.lexorion.horizon.product.repository.ProductRepository;
import com.lexorion.core.user.entity.*;
import com.lexorion.core.user.repository.UserRepository;
import com.lexorion.horizon.workspace.entity.*;
import com.lexorion.horizon.workspace.repository.OrganizationWorkspaceRepository;
import com.lexorion.horizon.tenantaccess.context.*;
import java.time.Instant;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.*;

@SpringBootTest @AutoConfigureMockMvc
class EntitlementSecurityIntegrationTest {
    private static final String HOST = "horizon.lexorion.in", PASSWORD = "correct-password";
    @Autowired MockMvc mvc; @Autowired UserRepository users; @Autowired OrganizationRepository organizations;
    @Autowired OrganizationMembershipRepository memberships; @Autowired OrganizationWorkspaceRepository workspaces;
    @Autowired ProductRepository products; @Autowired PlanRepository plans; @Autowired EntitlementDefinitionRepository definitions;
    @Autowired PlanEntitlementRepository planEntitlements; @Autowired EntitlementService entitlementService;
    @Autowired TenantAccessContextHolder tenantContexts;
    @Autowired OrganizationPlanAssignmentRepository assignments; @Autowired OrganizationSettingsRepository settings;
    @Autowired OrganizationInvitationRepository invitations; @Autowired OrganizationDomainRepository domains;
    @Autowired PlatformAccessRepository platformAccess; @Autowired RefreshTokenRepository refreshTokens; @Autowired PasswordEncoder encoder;
    private Organization alpha, beta; private User owner, admin, manager, member;

    @BeforeEach void setup() {
        clean(); resetCatalog(); alpha = organization("Alpha", "alpha"); beta = organization("Beta", "beta");
        owner = user("owner@alpha.test"); admin = user("admin@alpha.test"); manager = user("manager@alpha.test"); member = user("member@alpha.test");
        membership(alpha, owner, OrganizationRole.ADMIN); membership(alpha, admin, OrganizationRole.ADMIN);
        membership(alpha, manager, OrganizationRole.MANAGER); membership(alpha, member, OrganizationRole.EMPLOYEE);
    }
    @AfterEach void teardown() { clean(); resetCatalog(); }

    @Test void booleanCapabilitiesGrantOnlyForActiveTrueWellFormedValues() {
        assignDirect(alpha, "workforce", "workforce-growth"); OrganizationWorkspace workspace = workspace(alpha, "workforce", "people");
        withOwnerContext();
        try {
            assertThat(entitlementService.hasEntitlement(workspace, "workforce.attendance")).isTrue();
            entitlementService.requireEntitlement(workspace, "workforce.attendance");
            PlanEntitlement attendance = value("workforce-growth", "workforce.attendance"); attendance.setBooleanValue(false); planEntitlements.saveAndFlush(attendance);
            assertThat(entitlementService.hasEntitlement(workspace, "workforce.attendance")).isFalse();
            assertThatThrownBy(() -> entitlementService.requireEntitlement(workspace, "workforce.attendance")).isInstanceOf(EntitlementDeniedException.class);
            assertThat(entitlementService.hasEntitlement(workspace, "workforce.missing")).isFalse();
            EntitlementDefinition definition = definitions.findByKey("workforce.leave").orElseThrow(); definition.setStatus(CatalogStatus.INACTIVE); definitions.saveAndFlush(definition);
            assertThat(entitlementService.hasEntitlement(workspace, "workforce.leave")).isFalse();
            assertThatThrownBy(() -> entitlementService.hasEntitlement(workspace, "finance.invoicing")).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
            assertThatThrownBy(() -> entitlementService.hasEntitlement(workspace, "Bad Key")).isInstanceOf(InvalidEntitlementValueException.class);
        } finally { tenantContexts.clear(); }
    }

    @Test void integerLimitsEnforceBelowEqualAboveMissingInactiveAndInvalidValues() {
        assignDirect(alpha, "workforce", "workforce-starter"); OrganizationWorkspace workspace = workspace(alpha, "workforce", "people");
        withOwnerContext();
        try {
            assertThat(entitlementService.getIntegerLimit(workspace, "workforce.employee_limit")).isEqualTo(25);
            entitlementService.requireIntegerLimit(workspace, "workforce.employee_limit", 24);
            entitlementService.requireIntegerLimit(workspace, "workforce.employee_limit", 25);
            assertThatThrownBy(() -> entitlementService.requireIntegerLimit(workspace, "workforce.employee_limit", 26)).isInstanceOf(EntitlementDeniedException.class);
            assertThatThrownBy(() -> entitlementService.requireIntegerLimit(workspace, "workforce.employee_limit", -1)).isInstanceOf(InvalidEntitlementValueException.class);
            assertThatThrownBy(() -> entitlementService.getIntegerLimit(workspace, "workforce.missing_limit")).isInstanceOf(EntitlementDeniedException.class);
            EntitlementDefinition definition = definitions.findByKey("workforce.employee_limit").orElseThrow(); definition.setStatus(CatalogStatus.INACTIVE); definitions.saveAndFlush(definition);
            assertThatThrownBy(() -> entitlementService.getIntegerLimit(workspace, "workforce.employee_limit")).isInstanceOf(EntitlementDeniedException.class);
            definition.setStatus(CatalogStatus.ACTIVE); definitions.saveAndFlush(definition); PlanEntitlement value = value("workforce-starter", "workforce.employee_limit"); value.setIntegerValue(-1); planEntitlements.saveAndFlush(value);
            assertThatThrownBy(() -> entitlementService.getIntegerLimit(workspace, "workforce.employee_limit")).isInstanceOf(InvalidEntitlementValueException.class);
        } finally { tenantContexts.clear(); }
    }

    @Test void catalogUsesStableKeysAndNeverDisclosesUuids() throws Exception {
        tenant(get("/api/platform/plans"), owner, "alpha", HOST).andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.key == 'starter')]").isNotEmpty()).andExpect(jsonPath("$[0].id").doesNotExist()).andExpect(jsonPath("$[0].productId").doesNotExist());
        tenant(get("/api/platform/entitlements"), admin, "alpha", HOST).andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.key == 'workforce.employee_limit')]").isNotEmpty()).andExpect(jsonPath("$[0].id").doesNotExist());
    }

    @Test void platformOperatorCanReadCatalogsWithoutOrganizationContext() throws Exception {
        User platform = user("catalog-platform@test"); PlatformAccess access = new PlatformAccess();
        access.setUser(platform); access.setRole(PlatformRole.SUPER_ADMIN); access.setStatus(PlatformAccessStatus.ACTIVE);
        access.setGrantedAt(Instant.now()); platformAccess.saveAndFlush(access);

        request(get("/api/platform/plans"), platform, null, HOST).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].key").isNotEmpty());
        request(get("/api/platform/entitlements"), platform, null, HOST).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].key").isNotEmpty());
    }

    @Test void commercialPlansExposeLockedValuesAndWorkAcrossProducts() throws Exception {
        tenant(get("/api/platform/plans"), owner, "alpha", HOST).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2));
        for (String key : java.util.List.of("starter", "business")) {
            int employees = key.equals("starter") ? 25 : 100;
            int workspaceLimit = key.equals("starter") ? 1 : 3;
            tenant(get("/api/platform/plans"), owner, "alpha", HOST).andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.key == '" + key + "')].entitlements[?(@.key == 'platform.employee_limit')].integerValue").value(org.hamcrest.Matchers.hasItem(employees)))
                .andExpect(jsonPath("$[?(@.key == '" + key + "')].entitlements[?(@.key == 'platform.workspace_limit')].integerValue").value(org.hamcrest.Matchers.hasItem(workspaceLimit)));
            String slug = key.equals("starter") ? "alpha" : "beta";
            if (slug.equals("beta")) membership(beta, owner, OrganizationRole.ADMIN);
            assign(owner, "workforce", key, slug).andExpect(status().isCreated())
                .andExpect(jsonPath("$.entitlements[?(@.key == 'workforce.enabled')].booleanValue").value(org.hamcrest.Matchers.hasItem(true)))
                .andExpect(jsonPath("$.entitlements[?(@.key == 'payroll.enabled')].booleanValue").value(org.hamcrest.Matchers.hasItem(true)));
            assign(owner, "payroll", key, slug).andExpect(status().isCreated());
            assign(owner, "finance", key, slug).andExpect(status().isBadRequest());
            tenant(get("/api/tenant/entitlements"), owner, slug, HOST).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
        }
        assign(manager, "workforce", "starter", "alpha").andExpect(status().isForbidden());
        assign(member, "payroll", "starter", "alpha").andExpect(status().isForbidden());
    }

    @Test void platformProvisioningPreservesMembershipAndEnforcesConfiguredWorkspaceQuota() throws Exception {
        User platform = user("provisioner@test"); PlatformAccess access = new PlatformAccess();
        access.setUser(platform); access.setRole(PlatformRole.SUPER_ADMIN); access.setStatus(PlatformAccessStatus.ACTIVE);
        access.setGrantedAt(Instant.now()); platformAccess.saveAndFlush(access);
        for (String planKey : java.util.List.of("starter", "business")) {
            String slug = "provision-" + planKey;
            String body = "{\"name\":\"Test Organization\",\"organizationCode\":\"" + slug + "\",\"slug\":\"" + slug + "\",\"primaryEmail\":\"client@example.test\",\"ownerUserId\":\"" + owner.getId() + "\"}";
            var created = request(post("/api/platform/organizations").contentType(MediaType.APPLICATION_JSON).content(body), platform, null, HOST)
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("PENDING")).andReturn();
            String id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");
            String path = "/api/platform/organizations/" + id;
            request(patch(path).contentType(MediaType.APPLICATION_JSON).content("{\"planKey\":\"" + planKey + "\"}"), owner, null, HOST).andExpect(status().isForbidden());
            request(patch(path).contentType(MediaType.APPLICATION_JSON).content("{\"planKey\":\"" + planKey + "\"}"), platform, null, HOST).andExpect(status().isOk());
            request(patch(path + "/status").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ACTIVE\"}"), platform, null, HOST).andExpect(status().isOk());
            request(get("/api/platform/me/organizations"), owner, null, HOST).andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.slug == '" + slug + "')].membershipRole").value(org.hamcrest.Matchers.hasItem("ADMIN")));
            tenant(get("/api/tenant/entitlements"), owner, slug, HOST).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
            int quota = planKey.equals("starter") ? 1 : 3;
            for (int i = 0; i < quota; i++) {
                tenant(post("/api/tenant/workspaces").contentType(MediaType.APPLICATION_JSON).content("{\"key\":\"work-" + i + "\",\"displayName\":\"Work\",\"productKey\":\"workforce\"}"), owner, slug, HOST).andExpect(status().isCreated());
            }
            String extra = "{\"key\":\"extra\",\"displayName\":\"Payroll\",\"productKey\":\"payroll\"}";
            tenant(post("/api/tenant/workspaces").contentType(MediaType.APPLICATION_JSON).content(extra), owner, slug, HOST).andExpect(status().isForbidden());
            tenant(delete("/api/tenant/workspaces/work-0"), owner, slug, HOST).andExpect(status().isNoContent());
            tenant(post("/api/tenant/workspaces").contentType(MediaType.APPLICATION_JSON).content(extra), owner, slug, HOST).andExpect(status().isCreated());
            tenant(patch("/api/tenant/workspaces/work-0").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ACTIVE\"}"), owner, slug, HOST).andExpect(status().isForbidden());
            // Backend configuration changes capacity without plan-name branches.
            PlanEntitlement configured = value(planKey, "platform.workspace_limit"); configured.setIntegerValue(quota + 1); planEntitlements.saveAndFlush(configured);
            tenant(patch("/api/tenant/workspaces/work-0").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ACTIVE\"}"), owner, slug, HOST).andExpect(status().isOk());
            configured.setIntegerValue(quota); planEntitlements.saveAndFlush(configured);
            tenant(get("/api/tenant/workspaces/accessible"), owner, slug, HOST).andExpect(status().isOk());
            tenant(get("/api/tenant/workspaces/accessible"), platform, slug, HOST).andExpect(status().isForbidden());
        }
    }

    @Test void entitledProductsShareOneWorkspaceAndAuthorityRemainsScoped() throws Exception {
        for (String planKey : java.util.List.of("starter", "business")) {
            String slug = planKey.equals("starter") ? "alpha" : "beta";
            if (slug.equals("beta")) membership(beta, owner, OrganizationRole.ADMIN);
            assign(owner, "workforce", planKey, slug).andExpect(status().isCreated());
            String body = "{\"key\":\"shared\",\"displayName\":\"Shared\",\"productKeys\":[\"workforce\",\"payroll\"]}";
            tenant(post("/api/tenant/workspaces").contentType(MediaType.APPLICATION_JSON).content(body), owner, slug, HOST)
                .andExpect(status().isCreated()).andExpect(jsonPath("$.products.length()").value(2));
            var workforce = tenant(get("/internal/workforce/workspaces/shared/context"), owner, slug, HOST).andExpect(status().isOk()).andReturn();
            String workspaceId = JsonPath.read(workforce.getResponse().getContentAsString(), "$.workspaceId");
            mvc.perform(get("/internal/payroll/workspaces/shared/context").header("Host", HOST).header("Authorization", "Bearer " + token(owner))
                .header("X-Lexorion-Organization", slug).header("X-Lexorion-Service-Token", "test-payroll-service-token-32-bytes-minimum"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.workspaceId").value(workspaceId));
            String extra = body.replace("shared", "second");
            tenant(post("/api/tenant/workspaces").contentType(MediaType.APPLICATION_JSON).content(extra), owner, slug, HOST)
                .andExpect(planKey.equals("starter") ? status().isForbidden() : status().isCreated());
            tenant(patch("/api/tenant/workspaces/shared").contentType(MediaType.APPLICATION_JSON).content("{\"productKeys\":[\"workforce\",\"payroll\",\"finance\"]}"), owner, slug, HOST).andExpect(status().isForbidden());
            tenant(get("/api/tenant/workspaces/shared"), owner, slug, HOST).andExpect(status().isOk()).andExpect(jsonPath("$.products.length()").value(2));
        }
        tenant(post("/api/tenant/workspaces").contentType(MediaType.APPLICATION_JSON).content("{\"key\":\"denied\",\"displayName\":\"Denied\",\"productKeys\":[\"workforce\",\"payroll\"]}"), manager, "alpha", HOST).andExpect(status().isForbidden());
        tenant(get("/internal/workforce/workspaces/shared/context"), member, "beta", HOST).andExpect(status().isForbidden());
        tenant(get("/internal/workforce/workspaces/shared/context"), member, "alpha", HOST).andExpect(status().isOk());
        PlanEntitlement enabled = value("starter", "payroll.enabled"); enabled.setBooleanValue(false); planEntitlements.saveAndFlush(enabled);
        tenant(get("/api/tenant/workspaces/shared"), member, "alpha", HOST).andExpect(status().isOk()).andExpect(jsonPath("$.products.length()").value(1));
        mvc.perform(get("/internal/payroll/workspaces/shared/context").header("Host", HOST).header("Authorization", "Bearer " + token(member))
            .header("X-Lexorion-Organization", "alpha").header("X-Lexorion-Service-Token", "test-payroll-service-token-32-bytes-minimum"))
            .andExpect(status().isForbidden());
        enabled.setBooleanValue(true); planEntitlements.saveAndFlush(enabled);
    }

    @Test void ownerAndAdminCanAssignAndReadButDuplicateAndCrossProductAreRejected() throws Exception {
        assign(owner, "workforce", "workforce-starter", "alpha").andExpect(status().isCreated())
                .andExpect(jsonPath("$.productKey").value("workforce")).andExpect(jsonPath("$.planKey").value("workforce-starter"))
                .andExpect(jsonPath("$.id").doesNotExist()).andExpect(jsonPath("$.entitlements[?(@.key == 'workforce.employee_limit')].integerValue").value(25));
        assign(admin, "workforce", "workforce-growth", "alpha").andExpect(status().isConflict());
        assign(owner, "finance", "workforce-starter", "alpha").andExpect(status().isBadRequest());
        tenant(get("/api/tenant/entitlements"), admin, "alpha", HOST).andExpect(status().isOk()).andExpect(jsonPath("$[0].planKey").value("workforce-starter"));
    }

    @Test void rejectsInactivePlanAndAllIdentifierInjection() throws Exception {
        Plan plan = plan("workforce-starter"); plan.setStatus(CatalogStatus.INACTIVE); plans.saveAndFlush(plan);
        assign(owner, "workforce", "workforce-starter", "alpha").andExpect(status().isBadRequest());
        String body = "{\"planKey\":\"workforce-growth\",\"organizationId\":\"" + beta.getId() + "\",\"productId\":\"" + product("workforce").getId() + "\",\"planId\":\"" + plan.getId() + "\",\"workspaceId\":\"" + beta.getId() + "\",\"entitlementId\":\"" + plan.getId() + "\"}";
        tenant(post("/api/tenant/plan-assignments/workforce").contentType(MediaType.APPLICATION_JSON).content(body), owner, "alpha", HOST).andExpect(status().isBadRequest());
    }

    @Test void managerMemberAndPlatformAuthorityCannotReadOrMutateTenantCommercialState() throws Exception {
        assign(manager, "workforce", "workforce-starter", "alpha").andExpect(status().isForbidden());
        assign(member, "workforce", "workforce-starter", "alpha").andExpect(status().isForbidden());
        tenant(get("/api/tenant/entitlements"), manager, "alpha", HOST).andExpect(status().isForbidden());
        User platform = user("platform@test"); PlatformAccess access = new PlatformAccess(); access.setUser(platform); access.setRole(PlatformRole.SUPER_ADMIN); access.setStatus(PlatformAccessStatus.ACTIVE); access.setGrantedAt(Instant.now()); platformAccess.saveAndFlush(access);
        tenant(get("/api/tenant/entitlements"), platform, "alpha", HOST).andExpect(status().isForbidden());
        tenant(post("/api/platform/plans").contentType(MediaType.APPLICATION_JSON).content("{}"), member, "alpha", HOST).andExpect(status().isMethodNotAllowed());
        tenant(patch("/api/platform/entitlements/workforce.attendance").contentType(MediaType.APPLICATION_JSON).content("{}"), member, "alpha", HOST).andExpect(status().isNotFound());
    }

    @Test void effectiveEntitlementsAreExactlyTenantScoped() throws Exception {
        assignDirect(alpha, "workforce", "workforce-starter"); assignDirect(beta, "finance", "finance-starter");
        User dual = user("dual@test"); membership(alpha, dual, OrganizationRole.ADMIN); membership(beta, dual, OrganizationRole.ADMIN);
        tenant(get("/api/tenant/entitlements"), dual, "alpha", HOST).andExpect(status().isOk()).andExpect(jsonPath("$[0].productKey").value("workforce")).andExpect(jsonPath("$[?(@.productKey == 'finance')]").isEmpty());
        tenant(get("/api/tenant/entitlements"), dual, "beta", HOST).andExpect(status().isOk()).andExpect(jsonPath("$[0].productKey").value("finance"));
    }

    @Test void workspaceAccessFailsClosedForMissingInactivePlanAndInactiveProduct() throws Exception {
        workspace(alpha, "workforce", "people");
        tenant(get("/api/tenant/workspaces/people"), member, "alpha", HOST).andExpect(status().isForbidden());
        OrganizationPlanAssignment assignment = assignDirect(alpha, "workforce", "workforce-starter");
        tenant(get("/api/tenant/workspaces/people"), member, "alpha", HOST).andExpect(status().isOk());
        assignment.setStatus(AssignmentStatus.INACTIVE); assignments.saveAndFlush(assignment);
        tenant(get("/api/tenant/workspaces/people"), member, "alpha", HOST).andExpect(status().isForbidden());
        assignment.setStatus(AssignmentStatus.ACTIVE); assignments.saveAndFlush(assignment); Plan plan = plan("workforce-starter"); plan.setStatus(CatalogStatus.INACTIVE); plans.saveAndFlush(plan);
        tenant(get("/api/tenant/workspaces/people"), member, "alpha", HOST).andExpect(status().isForbidden());
        plan.setStatus(CatalogStatus.ACTIVE); plans.saveAndFlush(plan); Product product = product("workforce"); product.setStatus(ProductStatus.INACTIVE); products.saveAndFlush(product);
        tenant(get("/api/tenant/workspaces/people"), member, "alpha", HOST).andExpect(status().isForbidden());
    }

    @Test void sharedSlugAndWhiteLabelAuthorityRemainIntact() throws Exception {
        request(get("/api/tenant/entitlements"), owner, alpha.getId().toString(), HOST).andExpect(status().isBadRequest());
        request(get("/api/tenant/entitlements"), owner, "beta", HOST).andExpect(status().isForbidden());
        whiteLabel(alpha, "alpha.example"); request(get("/api/tenant/entitlements"), owner, null, "alpha.example").andExpect(status().isOk());
        request(get("/api/tenant/entitlements"), owner, "beta", "alpha.example").andExpect(status().isBadRequest());
    }

    @Test void internalWorkforceContractValidatesWorkspaceAndEmployeeLimitWithoutPublicIds() throws Exception {
        assignDirect(alpha, "workforce", "workforce-starter"); OrganizationWorkspace people = workspace(alpha, "workforce", "people");
        tenant(get("/internal/workforce/workspaces/people/context"), member, "alpha", HOST).andExpect(status().isOk())
                .andExpect(jsonPath("$.workspaceId").value(people.getId().toString()))
                .andExpect(jsonPath("$.workspaceKey").value("people"))
                .andExpect(jsonPath("$.organizationId").value(alpha.getId().toString()))
                .andExpect(jsonPath("$.organizationSlug").value("alpha"))
                .andExpect(jsonPath("$.role").value("EMPLOYEE"))
                .andExpect(jsonPath("$.userId").value(member.getId().toString()));
        tenant(post("/internal/workforce/workspaces/people/employee-limit").contentType(MediaType.APPLICATION_JSON)
                .content("{\"requestedValue\":25}"), owner, "alpha", HOST).andExpect(status().isOk());
        tenant(post("/internal/workforce/workspaces/people/employee-limit").contentType(MediaType.APPLICATION_JSON)
                .content("{\"requestedValue\":26}"), owner, "alpha", HOST).andExpect(status().isForbidden());
        tenant(get("/internal/workforce/workspaces/people/context"), owner, "beta", HOST).andExpect(status().isForbidden());
    }

    @Test void internalWorkforceContractRejectsSpoofedAuthorityAndInaccessibleWorkspaces() throws Exception {
        assignDirect(alpha, "workforce", "workforce-starter"); OrganizationWorkspace people = workspace(alpha, "workforce", "people");
        mvc.perform(get("/internal/workforce/workspaces/people/context").header("Host", HOST)
                .header("Authorization", "Bearer " + token(owner)).header("X-Lexorion-Organization", "alpha"))
                .andExpect(status().isUnauthorized());
        request(get("/internal/workforce/workspaces/people/context"), null, "alpha", HOST).andExpect(status().isUnauthorized());
        tenant(get("/internal/workforce/workspaces/Bad Key/context"), owner, "alpha", HOST).andExpect(status().isBadRequest());
        tenant(post("/internal/workforce/workspaces/people/employee-limit").contentType(MediaType.APPLICATION_JSON)
                .content("{\"requestedValue\":1,\"organizationId\":\"" + beta.getId() + "\",\"workspaceId\":\"" + people.getId()
                        + "\",\"userId\":\"" + member.getId() + "\",\"role\":\"ADMIN\"}"), owner, "alpha", HOST).andExpect(status().isBadRequest());
        tenant(get("/internal/workforce/workspaces/people/context").header("X-User-ID", member.getId())
                .header("X-Organization-ID", beta.getId()).header("X-Workspace-ID", beta.getId()).header("X-Role", "EMPLOYEE"), owner, "alpha", HOST)
                .andExpect(status().isOk()).andExpect(jsonPath("$.userId").value(owner.getId().toString()))
                .andExpect(jsonPath("$.organizationId").value(alpha.getId().toString())).andExpect(jsonPath("$.role").value("ADMIN"));
        people.setStatus(WorkspaceStatus.INACTIVE); workspaces.saveAndFlush(people);
        tenant(get("/internal/workforce/workspaces/people/context"), owner, "alpha", HOST).andExpect(status().isForbidden());
        people.setStatus(WorkspaceStatus.ACTIVE); workspaces.saveAndFlush(people); Product workforce = product("workforce");
        workforce.setStatus(ProductStatus.INACTIVE); products.saveAndFlush(workforce);
        tenant(get("/internal/workforce/workspaces/people/context"), owner, "alpha", HOST).andExpect(status().isForbidden());
    }

    @Test void internalWorkforceContractRejectsNonWorkforceAndInactiveMembership() throws Exception {
        assignDirect(alpha, "finance", "finance-starter"); workspace(alpha, "finance", "ledger");
        tenant(get("/internal/workforce/workspaces/ledger/context"), owner, "alpha", HOST).andExpect(status().isForbidden());
        assignDirect(alpha, "workforce", "workforce-starter"); workspace(alpha, "workforce", "people");
        OrganizationMembership membership = memberships.findAll().stream().filter(value -> value.getUser().getId().equals(member.getId())
                && value.getOrganization().getId().equals(alpha.getId())).findFirst().orElseThrow();
        membership.setStatus(MembershipStatus.INACTIVE); memberships.saveAndFlush(membership);
        tenant(get("/internal/workforce/workspaces/people/context"), member, "alpha", HOST).andExpect(status().isForbidden());
    }

    private ResultActions assign(User actor, String product, String plan, String slug) throws Exception { return tenant(post("/api/tenant/plan-assignments/" + product).contentType(MediaType.APPLICATION_JSON).content("{\"planKey\":\"" + plan + "\"}"), actor, slug, HOST); }
    private ResultActions tenant(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder req, User actor, String slug, String host) throws Exception { return request(req, actor, slug, host); }
    private ResultActions request(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder req, User actor, String slug, String host) throws Exception { req.header("Host", host).header("X-Lexorion-Service-Token", "test-workforce-service-token-32-bytes-minimum"); if (actor != null) req.header("Authorization", "Bearer " + token(actor)); if (slug != null) req.header("X-Lexorion-Organization", slug); return mvc.perform(req); }
    private String token(User user) throws Exception { MvcResult result = mvc.perform(post("/api/platform/auth/login").header("Host", HOST).contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + user.getEmail() + "\",\"password\":\"" + PASSWORD + "\"}")).andExpect(status().isOk()).andReturn(); return JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken"); }
    private Product product(String key) { return products.findByKey(key).orElseThrow(); } private Plan plan(String key) { return plans.findByKey(key).orElseThrow(); }
    private OrganizationPlanAssignment assignDirect(Organization org, String productKey, String planKey) { OrganizationPlanAssignment a = new OrganizationPlanAssignment(); a.setOrganization(org); a.setProduct(product(productKey)); a.setPlan(plan(planKey)); a.setStatus(AssignmentStatus.ACTIVE); return assignments.saveAndFlush(a); }
    private OrganizationWorkspace workspace(Organization org, String productKey, String key) { OrganizationWorkspace w = new OrganizationWorkspace(); w.setOrganization(org); w.setProduct(product(productKey)); w.setKey(key); w.setDisplayName("People"); w.setStatus(WorkspaceStatus.ACTIVE); return workspaces.saveAndFlush(w); }
    private PlanEntitlement value(String planKey, String entitlementKey) { return planEntitlements.findForPlan(plan(planKey).getId()).stream().filter(v -> v.getDefinition().getKey().equals(entitlementKey)).findFirst().orElseThrow(); }
    private void withOwnerContext() { tenantContexts.set(new TenantAccessContext(owner.getId(), alpha.getId(), alpha.getSlug(), OrganizationRole.ADMIN, MembershipStatus.ACTIVE, false)); }
    private Organization organization(String name, String slug) { Organization o = new Organization(); o.setName(name); o.setOrganizationCode(name.toUpperCase()); o.setSlug(slug); o.setPrimaryEmail("ops@" + slug + ".test"); o.setStatus(OrganizationStatus.ACTIVE); var saved = organizations.saveAndFlush(o); horizon.enroll(saved.getId()); return saved; }
    private User user(String email) { User u = new User(); u.setEmail(email); u.setFirstName("Test"); u.setLastName("User"); u.setPasswordHash(encoder.encode(PASSWORD)); u.setStatus(UserStatus.ACTIVE); return users.saveAndFlush(u); }
    private void membership(Organization org, User user, OrganizationRole role) { OrganizationMembership m = new OrganizationMembership(); m.setOrganization(org); m.setUser(user); m.setRole(role); m.setStatus(MembershipStatus.ACTIVE); m.setJoinedAt(Instant.now()); memberships.saveAndFlush(m); }
    private void whiteLabel(Organization org, String host) { OrganizationDomain d = new OrganizationDomain(); d.setOrganization(org); d.setHostname(host); d.setDomainType(DomainType.CUSTOM_DOMAIN); d.setAccessMode(DomainAccessMode.WHITE_LABEL); d.setVerificationStatus(DomainVerificationStatus.VERIFIED); d.setActive(true); d.setPrimaryDomain(true); d.setVerifiedAt(Instant.now()); domains.saveAndFlush(d); }
    private void resetCatalog() { plans.findAll().forEach(p -> { p.setStatus(CatalogStatus.ACTIVE); plans.save(p); }); definitions.findAll().forEach(d -> { d.setStatus(CatalogStatus.ACTIVE); definitions.save(d); }); products.findAll().forEach(p -> { p.setStatus(ProductStatus.ACTIVE); products.save(p); }); }
    private void clean() { refreshTokens.deleteAll(); invitations.deleteAll(); workspaces.deleteAll(); assignments.deleteAll(); domains.deleteAll(); memberships.deleteAll(); settings.deleteAll(); platformAccess.deleteAll(); coreGrants.deleteAll(); organizations.deleteAll(); users.deleteAll(); }
}
