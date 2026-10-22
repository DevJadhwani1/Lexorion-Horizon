package com.lexorion.platform.currentuser;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import com.lexorion.core.auth.repository.RefreshTokenRepository;
import com.lexorion.core.organization.entity.*;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.core.platformaccess.repository.PlatformAccessRepository;
import com.lexorion.core.user.entity.*;
import com.lexorion.core.user.repository.UserRepository;
import com.lexorion.horizon.entitlement.repository.OrganizationPlanAssignmentRepository;
import com.lexorion.horizon.invitation.repository.OrganizationInvitationRepository;
import com.lexorion.horizon.membership.entity.*;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import com.lexorion.horizon.organizationsettings.repository.OrganizationSettingsRepository;
import com.lexorion.horizon.product.repository.ProductRepository;
import com.lexorion.horizon.workspace.entity.*;
import com.lexorion.horizon.workspace.repository.OrganizationWorkspaceRepository;
import com.lexorion.platform.domain.repository.OrganizationDomainRepository;
import java.time.Instant;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.*;

@SpringBootTest @AutoConfigureMockMvc
class LastUsedContextIntegrationTest {
    private static final String HOST = "horizon.lexorion.in", PASSWORD = "correct-password";
    @Autowired MockMvc mvc; @Autowired UserRepository users; @Autowired OrganizationRepository organizations;
    @Autowired OrganizationMembershipRepository memberships; @Autowired OrganizationWorkspaceRepository workspaces;
    @Autowired ProductRepository products; @Autowired OrganizationPlanAssignmentRepository assignments;
    @Autowired OrganizationSettingsRepository settings; @Autowired OrganizationInvitationRepository invitations;
    @Autowired OrganizationDomainRepository domains; @Autowired PlatformAccessRepository platformAccess;
    @Autowired RefreshTokenRepository refreshTokens; @Autowired com.lexorion.core.product.ProductAccessRepository coreGrants;
    @Autowired com.lexorion.horizon.workspace.service.HorizonProvisioningService horizon; @Autowired PasswordEncoder encoder;
    private Organization alpha, beta, gamma; private User person; private OrganizationMembership betaMembership;

    @BeforeEach void setup() {
        clean(); alpha = organization("Alpha", "alpha"); beta = organization("Beta", "beta"); gamma = organization("Gamma", "gamma");
        person = user("person@alpha.test");
        membership(alpha, person); betaMembership = membership(beta, person);
        workspace(alpha, "people"); workspace(beta, "payday"); workspace(gamma, "secret");
    }
    @AfterEach void teardown() { clean(); }

    @Test void selectionIsPersistedPerUserAndPerOrganization() throws Exception {
        String token = token(person);
        call(get("/api/platform/me"), token).andExpect(status().isOk()).andExpect(jsonPath("$.lastOrganizationSlug").value(Matchers.nullValue()));
        save(token, "alpha", "people").andExpect(status().isNoContent());
        save(token, "beta", null).andExpect(status().isNoContent());
        call(get("/api/platform/me"), token).andExpect(jsonPath("$.lastOrganizationSlug").value("beta"));
        // Switching organization without a workspace keeps the workspace remembered for the other organization.
        call(get("/api/platform/me/organizations"), token)
            .andExpect(jsonPath("$[?(@.slug == 'alpha')].lastWorkspaceKey").value(Matchers.hasItem("people")))
            .andExpect(jsonPath("$[?(@.slug == 'beta')].lastWorkspaceKey").value(Matchers.hasItem(Matchers.nullValue())));
        save(token, "beta", "payday").andExpect(status().isNoContent());
        call(get("/api/platform/me/organizations"), token).andExpect(jsonPath("$[?(@.slug == 'beta')].lastWorkspaceKey").value(Matchers.hasItem("payday")));
    }

    @Test void inaccessibleOrganizationsAndForeignWorkspacesAreRejected() throws Exception {
        String token = token(person);
        save(token, "alpha", null).andExpect(status().isNoContent());
        save(token, "gamma", null).andExpect(status().isForbidden());
        save(token, "missing", null).andExpect(status().isForbidden());
        save(token, "alpha", "payday").andExpect(status().isForbidden());
        save(token, "alpha", "unknown").andExpect(status().isForbidden());
        call(put("/api/platform/me/context").contentType(MediaType.APPLICATION_JSON).content("{\"organizationSlug\":\"\"}"), token).andExpect(status().isBadRequest());
        call(get("/api/platform/me"), token).andExpect(jsonPath("$.lastOrganizationSlug").value("alpha"));
        call(get("/api/platform/me/organizations"), token).andExpect(jsonPath("$[?(@.slug == 'alpha')].lastWorkspaceKey").value(Matchers.hasItem(Matchers.nullValue())));
    }

    @Test void lastOrganizationIsNotReportedAfterAccessIsLost() throws Exception {
        String token = token(person);
        save(token, "beta", null).andExpect(status().isNoContent());
        betaMembership.setStatus(MembershipStatus.SUSPENDED); memberships.saveAndFlush(betaMembership);
        call(get("/api/platform/me"), token).andExpect(jsonPath("$.lastOrganizationSlug").value(Matchers.nullValue()));
        betaMembership.setStatus(MembershipStatus.ACTIVE); memberships.saveAndFlush(betaMembership);
        beta.setStatus(OrganizationStatus.SUSPENDED); organizations.saveAndFlush(beta);
        call(get("/api/platform/me"), token).andExpect(jsonPath("$.lastOrganizationSlug").value(Matchers.nullValue()));
        save(token, "beta", null).andExpect(status().isForbidden());
    }

    @Test void contextUpdatesRequireAuthentication() throws Exception {
        mvc.perform(put("/api/platform/me/context").header("Host", HOST).contentType(MediaType.APPLICATION_JSON).content("{\"organizationSlug\":\"alpha\"}"))
            .andExpect(status().isUnauthorized());
    }

    private ResultActions save(String token, String slug, String workspaceKey) throws Exception {
        String body = workspaceKey == null ? "{\"organizationSlug\":\"" + slug + "\"}" : "{\"organizationSlug\":\"" + slug + "\",\"workspaceKey\":\"" + workspaceKey + "\"}";
        return call(put("/api/platform/me/context").contentType(MediaType.APPLICATION_JSON).content(body), token);
    }
    private ResultActions call(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder req, String token) throws Exception { return mvc.perform(req.header("Host", HOST).header("Authorization", "Bearer " + token)); }
    private String token(User user) throws Exception { MvcResult result = mvc.perform(post("/api/platform/auth/login").header("Host", HOST).contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + user.getEmail() + "\",\"password\":\"" + PASSWORD + "\"}")).andExpect(status().isOk()).andReturn(); return JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken"); }
    private Organization organization(String name, String slug) { Organization o = new Organization(); o.setName(name); o.setOrganizationCode(name.toUpperCase()); o.setSlug(slug); o.setPrimaryEmail("ops@" + slug + ".test"); o.setStatus(OrganizationStatus.ACTIVE); var saved = organizations.saveAndFlush(o); horizon.enroll(saved.getId()); return saved; }
    private User user(String email) { User u = new User(); u.setEmail(email); u.setFirstName("Test"); u.setLastName("User"); u.setPasswordHash(encoder.encode(PASSWORD)); u.setStatus(UserStatus.ACTIVE); return users.saveAndFlush(u); }
    private OrganizationMembership membership(Organization org, User user) { OrganizationMembership m = new OrganizationMembership(); m.setOrganization(org); m.setUser(user); m.setRole(OrganizationRole.MANAGER); m.setStatus(MembershipStatus.ACTIVE); m.setJoinedAt(Instant.now()); return memberships.saveAndFlush(m); }
    private void workspace(Organization org, String key) { OrganizationWorkspace w = new OrganizationWorkspace(); w.setOrganization(org); w.setProduct(products.findByKey("workforce").orElseThrow()); w.setKey(key); w.setDisplayName("Work"); w.setStatus(WorkspaceStatus.ACTIVE); workspaces.saveAndFlush(w); }
    private void clean() { refreshTokens.deleteAll(); invitations.deleteAll(); workspaces.deleteAll(); assignments.deleteAll(); domains.deleteAll(); memberships.deleteAll(); settings.deleteAll(); platformAccess.deleteAll(); coreGrants.deleteAll(); users.deleteAll(); organizations.deleteAll(); }
}
