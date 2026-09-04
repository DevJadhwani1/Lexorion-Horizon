package com.lexorion.gateway;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;

@SpringBootTest(properties = {
        "eureka.client.enabled=false",
        "spring.cloud.discovery.enabled=false",
        "server.port=0"
})
class ApiGatewayApplicationTests {
    @Autowired Environment environment;

    @Test
    void contextLoadsWithExpectedIdentityAndPortDefault() {
        assertThat(environment.getProperty("spring.application.name")).isEqualTo("api-gateway");
    }

    @Test
    void allPublicRoutesUseExpectedDiscoveryServices() {
        assertRoute(0, "/api/platform/**", "lb://PLATFORM-SERVICE");
        assertRoute(1, "/api/tenant/**", "lb://PLATFORM-SERVICE");
        assertRoute(2, "/api/workforce/**", "lb://WORKFORCE-SERVICE");
        assertRoute(3, "/api/payroll/**", "lb://PAYROLL-SERVICE");
        assertRoute(4, "/api/finance/**", "lb://FINANCE-SERVICE");
    }

    @Test
    void trustedAuthorityHeadersAreRemovedAtTheGatewayBoundary() {
        assertThat(environment.getProperty("spring.cloud.gateway.server.webmvc.default-filters[0]"))
                .isEqualTo("RemoveRequestHeader=X-Lexorion-Trusted-Organization-Id");
        assertThat(environment.getProperty("spring.cloud.gateway.server.webmvc.default-filters[1]"))
                .isEqualTo("RemoveRequestHeader=X-Lexorion-Trusted-Workspace-Id");
        assertThat(environment.getProperty("spring.cloud.gateway.server.webmvc.default-filters[2]"))
                .isEqualTo("RemoveRequestHeader=X-Lexorion-Trusted-User-Id");
        assertThat(environment.getProperty("spring.cloud.gateway.server.webmvc.default-filters[3]"))
                .isEqualTo("RemoveRequestHeader=X-Lexorion-Trusted-Role");
    }

    private void assertRoute(int index, String path, String uri) {
        String base = "spring.cloud.gateway.server.webmvc.routes[" + index + "]";
        assertThat(environment.getProperty(base + ".predicates[0]")).isEqualTo("Path=" + path);
        assertThat(environment.getProperty(base + ".uri")).isEqualTo(uri);
    }
}
