package com.lexorion.platform;

import com.jayway.jsonpath.JsonPath;
import com.lexorion.core.auth.repository.RefreshTokenRepository;
import com.lexorion.core.organization.CoreMembershipRepository;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.core.platformaccess.entity.*;
import com.lexorion.core.platformaccess.repository.PlatformAccessRepository;
import com.lexorion.core.product.*;
import com.lexorion.core.user.dto.CreateUserRequest;
import com.lexorion.core.user.service.UserService;
import com.lexorion.core.user.repository.UserRepository;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Boots ONLY Core. No Horizon entities, repositories, configuration, catalog or routing. */
@SpringBootTest(classes = CoreStandaloneIntegrationTest.CoreOnly.class, properties = {
        "spring.datasource.url=jdbc:h2:mem:core-only;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "logging.level.org.hibernate.SQL=WARN"})
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class CoreStandaloneIntegrationTest {
    @Configuration(proxyBeanMethods = false)
    @EnableAutoConfiguration
    @ComponentScan("com.lexorion.core")
    @EntityScan("com.lexorion.core")
    @EnableJpaRepositories("com.lexorion.core")
    static class CoreOnly {}

    @Autowired MockMvc mvc;
    @Autowired UserService userService;
    @Autowired UserRepository users;
    @Autowired PlatformAccessRepository operators;
    @Autowired CoreMembershipRepository memberships;
    @Autowired OrganizationRepository organizations;
    @Autowired CoreProductRepository products;
    @Autowired ProductAccessRepository grants;
    @Autowired RefreshTokenRepository tokens;
    @Autowired JdbcTemplate sql;
    String operatorToken;

    @BeforeEach void setup() throws Exception {
        tokens.deleteAll(); operators.deleteAll(); grants.deleteAll(); memberships.deleteAll(); organizations.deleteAll(); products.deleteAll(); users.deleteAll();
        var user = userService.create(new CreateUserRequest("operator@core.test", "Global", "Operator", "correct-password"));
        var operator = new PlatformAccess(); operator.setUser(users.findById(user.id()).orElseThrow()); operator.setRole(PlatformRole.SUPER_ADMIN);
        operator.setStatus(PlatformAccessStatus.ACTIVE); operator.setGrantedAt(Instant.now()); operators.saveAndFlush(operator);
        operatorToken = login("operator@core.test");
    }

    @Test void futureProductsOnboardAndConsumeCoreWithoutAnyHorizonTables() throws Exception {
        String userResponse = perform(post("/api/core/users"), operatorToken,
                "{\"email\":\"traveler@core.test\",\"firstName\":\"New\",\"lastName\":\"Member\",\"password\":\"correct-password\"}");
        String userId = JsonPath.read(userResponse, "$.id");
        String orgResponse = perform(post("/api/core/organizations"), operatorToken,
                "{\"name\":\"Universal organization\",\"organizationCode\":\"UNIVERSAL\",\"primaryEmail\":\"ops@core.test\",\"initialUserId\":\"" + userId + "\"}");
        String orgId = JsonPath.read(orgResponse, "$.id");
        assertThat(grants.count()).isZero(); // Core onboarding enrolls no product implicitly.
        perform(patch("/api/core/organizations/" + orgId + "/status"), operatorToken, "{\"status\":\"ACTIVE\"}");
        String memberToken = login("traveler@core.test");
        for (String key : new String[]{"horizon", "axon", "atlas", "lexorion-travel"}) {
            String product = perform(post("/api/core/products"), operatorToken, "{\"key\":\"" + key + "\",\"displayName\":\"" + key + "\",\"active\":true}");
            String productId = JsonPath.read(product, "$.id");
            mvc.perform(put("/api/core/organizations/" + orgId + "/products/" + key).header("Authorization", "Bearer " + operatorToken)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ACTIVE\"}")).andExpect(status().isNoContent());
            mvc.perform(get("/api/core/me/organizations/" + orgId + "/products/" + key + "/context").header("Authorization", "Bearer " + memberToken))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.userId").value(userId)).andExpect(jsonPath("$.organizationId").value(orgId))
                    .andExpect(jsonPath("$.productId").value(productId)).andExpect(jsonPath("$.productKey").value(key))
                    .andExpect(jsonPath("$.role").doesNotExist()).andExpect(jsonPath("$.workspace").doesNotExist());
        }
        assertThat(sql.queryForList("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC'", String.class))
                .doesNotContain("HORIZON_MEMBERSHIP_ROLES", "ORGANIZATION_WORKSPACES", "PLANS", "PRODUCTS", "ENTITLEMENT_DEFINITIONS");
        assertThat(memberships.count()).isEqualTo(1);
        // Authorization belongs to the consuming product, after independently validated Core entry.
        String entry = mvc.perform(get("/api/core/me/organizations/" + orgId + "/products/lexorion-travel/context")
                .header("Authorization", "Bearer " + memberToken)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        var travel = new TravelAuthorization();
        UUID traveler = UUID.fromString(JsonPath.read(entry, "$.userId"));
        UUID travelOrganization = UUID.fromString(JsonPath.read(entry, "$.organizationId"));
        assertThat(travel.canBook(traveler, travelOrganization)).isFalse();
        travel.allowBooking(traveler, travelOrganization);
        assertThat(travel.canBook(traveler, travelOrganization)).isTrue();
        assertThat(travel.canBook(traveler, UUID.randomUUID())).isFalse();
        mvc.perform(get("/api/core/me/organizations/" + UUID.randomUUID() + "/products/lexorion-travel/context")
                .header("Authorization", "Bearer " + memberToken)).andExpect(status().isForbidden());

        mvc.perform(get("/api/core/me/organizations/" + orgId + "/products").header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(4));
        mvc.perform(get("/api/core/users").header("Authorization", "Bearer " + memberToken)).andExpect(status().isForbidden());
        mvc.perform(post("/api/core/products").header("Authorization", "Bearer " + memberToken).contentType(MediaType.APPLICATION_JSON)
                .content("{\"key\":\"forbidden\",\"displayName\":\"Forbidden\",\"active\":true}")).andExpect(status().isForbidden());
    }

    @Test void consoleEndpointsReturnRealDataWithoutExposingSecretsAndSessionsCanBeRevoked() throws Exception {
        for (String path : new String[]{"overview", "organizations", "users", "products", "product-access", "operators", "sessions", "security", "audit"}) {
            String response = mvc.perform(get("/api/core/" + path).header("Authorization", "Bearer " + operatorToken)).andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString();
            assertThat(response).doesNotContain("passwordHash", "tokenHash", "replacedByHash", "test-only-jwt-secret");
            mvc.perform(get("/api/core/" + path)).andExpect(status().isUnauthorized());
        }
        String operatorId = users.findByEmailIgnoreCase("operator@core.test").orElseThrow().getId().toString();
        mvc.perform(post("/api/core/users/" + operatorId + "/sessions/revoke").header("Authorization", "Bearer " + operatorToken)).andExpect(status().isNoContent());
        assertThat(tokens.findByUserIdAndRevokedFalse(UUID.fromString(operatorId))).isEmpty();
        mvc.perform(get("/api/core/audit").header("Authorization", "Bearer " + operatorToken)).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].operation").value("OPERATOR_SESSIONS_REVOKE"));
    }

    // Test-only Travel domain policy: deliberately outside com.lexorion.core.
    private static final class TravelAuthorization {
        private record BookingAuthority(UUID userId, UUID organizationId) {}
        private final java.util.Set<BookingAuthority> bookings = new java.util.HashSet<>();
        void allowBooking(UUID userId, UUID organizationId) { bookings.add(new BookingAuthority(userId, organizationId)); }
        boolean canBook(UUID userId, UUID organizationId) { return bookings.contains(new BookingAuthority(userId, organizationId)); }
    }

    private String login(String email) throws Exception {
        String response = mvc.perform(post("/api/core/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"correct-password\"}")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(response, "$.accessToken");
    }
    private String perform(MockHttpServletRequestBuilder request, String token, String body) throws Exception {
        return mvc.perform(request.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }
}
