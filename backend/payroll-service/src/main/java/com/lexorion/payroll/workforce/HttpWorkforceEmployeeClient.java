package com.lexorion.payroll.workforce;

import com.lexorion.payroll.api.PayrollException;
import com.lexorion.payroll.tenant.AuthorityRequestContext;
import com.lexorion.payroll.tenant.TrustedPayrollContext;
import java.net.SocketTimeoutException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class HttpWorkforceEmployeeClient implements WorkforceEmployeeClient {
    static final String ORGANIZATION_ID = "X-Lexorion-Trusted-Organization-Id";
    static final String WORKSPACE_ID = "X-Lexorion-Trusted-Workspace-Id";
    static final String USER_ID = "X-Lexorion-Trusted-User-Id";
    static final String ROLE = "X-Lexorion-Trusted-Role";
    private final RestClient client;
    private final AuthorityRequestContext requests;

    public HttpWorkforceEmployeeClient(@Qualifier("serviceRestClientBuilder") RestClient.Builder builder,
            @Value("${lexorion.workforce-service-url:http://workforce-service}") String baseUrl,
            AuthorityRequestContext requests) {
        this.client = builder.baseUrl(baseUrl).build();
        this.requests = requests;
    }

    @Override
    public WorkforceEmployeeVerifier.Verification verify(String employeeCode, TrustedPayrollContext context) {
        AuthorityRequestContext.Credentials credentials = requests.get()
                .orElseThrow(() -> new PayrollException(503, "Workforce verification authority is unavailable"));
        try {
            return client.get()
                    .uri("/internal/workforce/employees/{employeeCode}/verification", employeeCode)
                    .header(HttpHeaders.AUTHORIZATION, credentials.bearerToken())
                    .header(HttpHeaders.HOST, credentials.host())
                    .header("X-Lexorion-Organization", context.organizationSlug())
                    .header("X-Lexorion-Workspace", context.workspaceKey())
                    .header(ORGANIZATION_ID, context.organizationId().toString())
                    .header(WORKSPACE_ID, context.workspaceId().toString())
                    .header(USER_ID, context.userId().toString())
                    .header(ROLE, context.role())
                    .exchange((request, response) -> mapResponse(response.getStatusCode(), response.bodyTo(WorkforceEmployeeVerifier.Verification.class)));
        } catch (ResourceAccessException ex) {
            throw new PayrollException(503, causedByTimeout(ex) ? "Workforce verification timed out" : "Workforce verification is unavailable");
        } catch (PayrollException ex) {
            throw ex;
        } catch (RestClientException | IllegalArgumentException ex) {
            throw new PayrollException(502, "Workforce returned an invalid verification response");
        }
    }

    private WorkforceEmployeeVerifier.Verification mapResponse(HttpStatusCode status, WorkforceEmployeeVerifier.Verification body) {
        if (status.value() == 403) throw new PayrollException(403, "Workforce workspace access denied");
        if (status.value() == 404) throw new PayrollException(404, "Employee not found in the authorized Workforce workspace");
        if (!status.is2xxSuccessful()) throw new PayrollException(503, "Workforce verification is unavailable");
        if (body == null) throw new PayrollException(502, "Workforce returned an invalid verification response");
        return body;
    }

    private boolean causedByTimeout(Throwable error) {
        for (Throwable current = error; current != null; current = current.getCause()) {
            if (current instanceof SocketTimeoutException) return true;
        }
        return false;
    }
}
