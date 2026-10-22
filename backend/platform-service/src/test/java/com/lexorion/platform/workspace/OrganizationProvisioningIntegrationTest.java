package com.lexorion.platform.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.lexorion.core.auth.repository.RefreshTokenRepository;
import com.lexorion.core.organization.entity.Organization;
import com.lexorion.core.organization.entity.OrganizationStatus;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.core.user.entity.User;
import com.lexorion.core.user.entity.UserStatus;
import com.lexorion.core.user.repository.UserRepository;
import com.lexorion.horizon.entitlement.repository.OrganizationPlanAssignmentRepository;
import com.lexorion.horizon.entitlement.repository.PlanRepository;
import com.lexorion.horizon.invitation.repository.OrganizationInvitationRepository;
import com.lexorion.horizon.membership.entity.MembershipStatus;
import com.lexorion.horizon.membership.entity.OrganizationMembership;
import com.lexorion.horizon.membership.entity.OrganizationRole;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import com.lexorion.horizon.organizationsettings.repository.OrganizationSettingsRepository;
import com.lexorion.horizon.workspace.repository.OrganizationWorkspaceRepository;
import com.lexorion.platform.domain.repository.OrganizationDomainRepository;
import com.lexorion.platform.organization.dto.CreateOrganizationRequest;
import com.lexorion.platform.organization.service.OrganizationService;
import java.time.Instant;
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
class OrganizationProvisioningIntegrationTest {
    private static final String HOST = "horizon.lexorion.in";
    private static final String PASSWORD = "correct-password";

    @Autowired MockMvc mockMvc;
    @Autowired UserRepository users;
    @Autowired OrganizationRepository organizations;
    @Autowired OrganizationMembershipRepository memberships;
    @Autowired OrganizationWorkspaceRepository workspaces;
    @Autowired OrganizationPlanAssignmentRepository planAssignments;
    @Autowired PlanRepository plans;
    @Autowired RefreshTokenRepository refreshTokens;
    @Autowired OrganizationInvitationRepository invitations;
    @Autowired OrganizationDomainRepository domains;
    @Autowired OrganizationSettingsRepository settings;
    @Autowired OrganizationService organizationService;
    @Autowired PasswordEncoder passwordEncoder;

    private User owner;
    private User member;

    @BeforeEach
    void setUp() {
        cleanData();
        owner = user("owner@provision.test");
        member = user("member@provision.test");
    }

    @AfterEach
    void tearDown() {
        cleanData();
    }

    @Test
    void organizationCreationDoesNotInventAPlan() {
        var created = organizationService.create(new CreateOrganizationRequest(
                "Acme Corp", "Acme Corporation Inc", "ACME", "acme-corp",
                "admin@acme.test", "+1234567890", owner.getId()));

        var planAssignment = planAssignments.findForOrganization(created.id());
        assertThat(planAssignment).isEmpty();

        var org = organizations.findById(created.id()).orElseThrow();
        assertThat(org.getSlug()).isEqualTo("acme-corp");
    }

    @Test
    void emptyProductSelectionDerivesProductsFromThePersistedPlan() throws Exception {
        var created = organizationService.create(new CreateOrganizationRequest(
                "Empty Selection Org", null, "EMPTY", "empty-selection-org",
                "admin@empty-selection.test", null, owner.getId(),
                "starter", OrganizationStatus.ACTIVE));

        tenantPost("/api/tenant/workspaces",
                "{\"key\":\"main\",\"displayName\":\"Main HR\",\"productKeys\":[]}",
                token(owner), "empty-selection-org")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.products.length()").value(2));
    }

    @Test
    void normallyProvisionedCustomerDoesNotNeedManualActivationToCreateWorkspace() throws Exception {
        var created = organizationService.create(new CreateOrganizationRequest(
                "Customer Org", "Customer Legal", "CUST", "customer-org",
                "admin@customer.test", "+1234567890", owner.getId(),
                "starter", OrganizationStatus.ACTIVE));

        var org = organizations.findById(created.id()).orElseThrow();
        assertThat(org.getStatus()).isEqualTo(OrganizationStatus.ACTIVE);
        assertThat(org.getActivatedAt()).isNotNull();

        // Customer logs in, establishes tenant context, and immediately provisions first workspace
        String token = token(owner);
        tenantPost("/api/tenant/workspaces",
                "{\"key\":\"main\",\"displayName\":\"Main HR\"}",
                token, "customer-org")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.key").value("main"))
                .andExpect(jsonPath("$.displayName").value("Main HR"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.products.length()").value(2)); // workforce and payroll capabilities attached from entitlements
    }

    @Test
    void workspaceLimitIsEnforcedOnBackendForStarterPlan() throws Exception {
        var created = organizationService.create(new CreateOrganizationRequest(
                "Limit Org", null, "LIMIT", "limit-org",
                "admin@limit.test", null, owner.getId(),
                "starter", OrganizationStatus.ACTIVE));

        String token = token(owner);

        // First workspace provisioned successfully under Starter quota (limit = 1)
        tenantPost("/api/tenant/workspaces",
                "{\"key\":\"ws-one\",\"displayName\":\"Workspace One\"}",
                token, "limit-org")
                .andExpect(status().isCreated());

        // Second workspace provisioned under Starter quota is rejected
        tenantPost("/api/tenant/workspaces",
                "{\"key\":\"ws-two\",\"displayName\":\"Workspace Two\"}",
                token, "limit-org")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Workspace limit exceeded"));
    }

    @Test
    void workspaceCreationRequiresAdminRoleAuthorization() throws Exception {
        var created = organizationService.create(new CreateOrganizationRequest(
                "Auth Org", null, "AUTH", "auth-org",
                "admin@auth.test", null, owner.getId(),
                "starter", OrganizationStatus.ACTIVE));

        membership(organizations.findById(created.id()).orElseThrow(), member, OrganizationRole.EMPLOYEE, MembershipStatus.ACTIVE);

        String memberToken = token(member);
        tenantPost("/api/tenant/workspaces",
                "{\"key\":\"unauthorized\",\"displayName\":\"Unauthorized\"}",
                memberToken, "auth-org")
                .andExpect(status().isForbidden());
    }

    @Test
    void missingPlanEnforcesRejectionAndDoesNotBypass() throws Exception {
        var created = organizationService.create(new CreateOrganizationRequest(
                "NoPlan Org", null, "NOPLAN", "noplan-org",
                "admin@noplan.test", null, owner.getId(),
                "starter", OrganizationStatus.ACTIVE));

        // Delete plan assignment to simulate genuinely missing plan
        planAssignments.deleteAll();

        String token = token(owner);
        tenantPost("/api/tenant/workspaces",
                "{\"key\":\"blocked\",\"displayName\":\"Blocked\"}",
                token, "noplan-org")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("An active organization plan is required"));
    }

    private ResultActions tenantPost(String path, String body, String token, String slug) throws Exception {
        return mockMvc.perform(post(path)
                .header("Authorization", "Bearer " + token)
                .header("Host", HOST)
                .header("X-Lexorion-Organization", slug)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private User user(String email) {
        User u = new User();
        u.setEmail(email);
        u.setFirstName("Test");
        u.setLastName("User");
        u.setStatus(UserStatus.ACTIVE);
        u.setPasswordHash(passwordEncoder.encode(PASSWORD));
        return users.saveAndFlush(u);
    }

    private OrganizationMembership membership(Organization org, User user, OrganizationRole role, MembershipStatus status) {
        OrganizationMembership m = new OrganizationMembership();
        m.setOrganization(org);
        m.setUser(user);
        m.setRole(role);
        m.setStatus(status);
        m.setJoinedAt(Instant.now());
        return memberships.saveAndFlush(m);
    }

    private String token(User user) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/platform/auth/login")
                        .header("Host", HOST)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + user.getEmail() + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
    }

    private void cleanData() {
        refreshTokens.deleteAll();
        invitations.deleteAll();
        workspaces.deleteAll();
        planAssignments.deleteAll();
        domains.deleteAll();
        memberships.deleteAll();
        settings.deleteAll();
        organizations.deleteAll();
        users.deleteAll();
    }
}
