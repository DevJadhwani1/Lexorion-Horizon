package com.lexorion.finance.tenant;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Asks Platform whether the delegated user may use the Finance product in the selected workspace. */
@Component
public class PlatformFinanceAuthorityClient implements FinanceAuthorityClient {
    private final RestClient client;
    private final String serviceToken;

    public PlatformFinanceAuthorityClient(@Qualifier("serviceRestClientBuilder") RestClient.Builder builder,
            @Value("${lexorion.platform-service-url}") String url,
            @Value("${lexorion.service-auth.finance-token}") String serviceToken) {
        if (serviceToken == null || serviceToken.length() < 32)
            throw new IllegalStateException("Finance service token must be at least 32 characters");
        this.client = builder.baseUrl(url).build();
        this.serviceToken = serviceToken;
    }

    @Override
    public TrustedFinanceContext validate(String key, String token, String host, String slug) {
        return client.get().uri("/internal/finance/workspaces/{key}/context", key)
                .header(HttpHeaders.AUTHORIZATION, token)
                .header(HttpHeaders.HOST, host)
                .header("X-Lexorion-Service-Token", serviceToken)
                .headers(h -> { if (slug != null) h.set("X-Lexorion-Organization", slug); })
                .retrieve().body(TrustedFinanceContext.class);
    }
}
