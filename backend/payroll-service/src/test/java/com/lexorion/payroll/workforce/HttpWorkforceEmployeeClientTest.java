package com.lexorion.payroll.workforce;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.lexorion.payroll.api.PayrollException;
import com.lexorion.payroll.tenant.AuthorityRequestContext;
import com.lexorion.payroll.tenant.TrustedPayrollContext;
import java.net.SocketTimeoutException;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class HttpWorkforceEmployeeClientTest {
    private static final UUID WORKSPACE = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID ORGANIZATION = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID USER = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private AuthorityRequestContext requests;
    private MockRestServiceServer server;
    private HttpWorkforceEmployeeClient client;
    private TrustedPayrollContext context;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        requests = new AuthorityRequestContext();
        requests.set(new AuthorityRequestContext.Credentials("Bearer owner", "horizon.lexorion.in", "alpha"));
        client = new HttpWorkforceEmployeeClient(builder, "http://workforce-service", requests);
        context = new TrustedPayrollContext(WORKSPACE, "a", ORGANIZATION, "alpha", "OWNER", USER);
    }

    @AfterEach void clear() { requests.clear(); }

    @Test
    void sendsOnlyTrustedAuthorityAndMapsMinimumResponse() {
        server.expect(once(), requestTo("http://workforce-service/internal/workforce/employees/EMP-1/verification"))
                .andExpect(header("Authorization", "Bearer owner"))
                .andExpect(header("X-Lexorion-Workspace", "a"))
                .andExpect(header("X-Lexorion-Organization", "alpha"))
                .andExpect(header("X-Lexorion-Trusted-Organization-Id", ORGANIZATION.toString()))
                .andExpect(header("X-Lexorion-Trusted-Workspace-Id", WORKSPACE.toString()))
                .andExpect(header("X-Lexorion-Trusted-User-Id", USER.toString()))
                .andExpect(header("X-Lexorion-Trusted-Role", "OWNER"))
                .andRespond(withSuccess("{\"employeeCode\":\"EMP-1\",\"exists\":true,\"employmentStatus\":\"ACTIVE\"}", MediaType.APPLICATION_JSON));

        var result = client.verify("EMP-1", context);
        assertThat(result).isEqualTo(new WorkforceEmployeeVerifier.Verification("EMP-1", true, WorkforceEmploymentStatus.ACTIVE));
        server.verify();
    }

    @Test
    void unavailableTimeoutAndMalformedResponsesFailClosed() {
        server.expect(requestTo("http://workforce-service/internal/workforce/employees/UNAVAILABLE/verification"))
                .andRespond(withException(new java.net.ConnectException("refused")));
        assertThatThrownBy(() -> client.verify("UNAVAILABLE", context)).isInstanceOf(PayrollException.class)
                .extracting(e -> ((PayrollException)e).status()).isEqualTo(503);

        server.reset();
        server.expect(requestTo("http://workforce-service/internal/workforce/employees/TIMEOUT/verification"))
                .andRespond(withException(new SocketTimeoutException("timed out")));
        assertThatThrownBy(() -> client.verify("TIMEOUT", context)).isInstanceOf(PayrollException.class)
                .hasMessageContaining("timed out");

        server.reset();
        server.expect(requestTo("http://workforce-service/internal/workforce/employees/MALFORMED/verification"))
                .andRespond(withSuccess("{\"exists\":true}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> client.verify("MALFORMED", context)).isInstanceOf(PayrollException.class)
                .extracting(e -> ((PayrollException)e).status()).isEqualTo(502);
    }

    @Test
    void downstreamNotFoundAndCrossTenantDenialArePreserved() {
        server.expect(requestTo("http://workforce-service/internal/workforce/employees/MISSING/verification"))
                .andRespond(request -> new org.springframework.mock.http.client.MockClientHttpResponse(new byte[0], 404));
        assertThatThrownBy(() -> client.verify("MISSING", context)).isInstanceOf(PayrollException.class)
                .extracting(e -> ((PayrollException)e).status()).isEqualTo(404);

        server.reset();
        server.expect(requestTo("http://workforce-service/internal/workforce/employees/FOREIGN/verification"))
                .andRespond(request -> new org.springframework.mock.http.client.MockClientHttpResponse(new byte[0], 403));
        assertThatThrownBy(() -> client.verify("FOREIGN", context)).isInstanceOf(PayrollException.class)
                .extracting(e -> ((PayrollException)e).status()).isEqualTo(403);
    }
}
