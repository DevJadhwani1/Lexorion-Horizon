package com.lexorion.payroll.entitlement;

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
public class PlatformPayrollProcessingEntitlementGate implements PayrollProcessingEntitlementGate {
    private final RestClient client;
    private final AuthorityRequestContext requests;

    public PlatformPayrollProcessingEntitlementGate(@Qualifier("serviceRestClientBuilder") RestClient.Builder builder,
            @Value("${lexorion.platform-service-url}") String baseUrl,
            AuthorityRequestContext requests) {
        this.client = builder.baseUrl(baseUrl).build();
        this.requests = requests;
    }

    @Override
    public void requireProcessing(TrustedPayrollContext context) {
        AuthorityRequestContext.Credentials credentials = requests.get()
                .orElseThrow(() -> new PayrollException(503, "Platform entitlement authority is unavailable"));
        try {
            CapabilityResponse response = client.get()
                    .uri("/internal/payroll/workspaces/{key}/capabilities/payroll-processing", context.workspaceKey())
                    .header(HttpHeaders.AUTHORIZATION, credentials.bearerToken())
                    .header(HttpHeaders.HOST, credentials.host())
                    .header("X-Lexorion-Organization", context.organizationSlug())
                    .exchange((request, result) -> map(result.getStatusCode(), result.bodyTo(CapabilityResponse.class)));
            if (response == null || !"payroll.processing".equals(response.capability()) || !response.allowed()) {
                throw new PayrollException(403, "payroll.processing entitlement is required");
            }
        } catch (ResourceAccessException ex) {
            throw new PayrollException(503, causedByTimeout(ex)
                    ? "Platform entitlement verification timed out"
                    : "Platform entitlement authority is unavailable");
        } catch (PayrollException ex) {
            throw ex;
        } catch (RestClientException | IllegalArgumentException ex) {
            throw new PayrollException(502, "Platform returned an invalid entitlement response");
        }
    }

    private CapabilityResponse map(HttpStatusCode status, CapabilityResponse body) {
        if (status.value() == 401 || status.value() == 403 || status.value() == 404) {
            throw new PayrollException(403, "payroll.processing entitlement is required");
        }
        if (!status.is2xxSuccessful()) {
            throw new PayrollException(503, "Platform entitlement authority is unavailable");
        }
        return body;
    }

    private boolean causedByTimeout(Throwable error) {
        for (Throwable current = error; current != null; current = current.getCause()) {
            if (current instanceof SocketTimeoutException) return true;
        }
        return false;
    }

    record CapabilityResponse(String capability, boolean allowed) { }
}
