package com.lexorion.eureka;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import com.netflix.eureka.EurekaServerContext;
import org.springframework.core.env.Environment;

@SpringBootTest(properties = "server.port=0")
class EurekaServerApplicationTests {
    @Autowired Environment environment;
    @Autowired EurekaServerContext serverContext;

    @Test
    void contextLoadsAsStandaloneRegistry() {
        assertThat(serverContext).isNotNull();
        assertThat(environment.getProperty("spring.application.name")).isEqualTo("eureka-server");
        assertThat(environment.getProperty("eureka.client.register-with-eureka", Boolean.class)).isFalse();
        assertThat(environment.getProperty("eureka.client.fetch-registry", Boolean.class)).isFalse();
    }
}
