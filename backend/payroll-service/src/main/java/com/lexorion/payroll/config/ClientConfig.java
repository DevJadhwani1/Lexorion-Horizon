package com.lexorion.payroll.config;

import java.time.Duration;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class ClientConfig {
    @Bean
    @Primary
    RestClient.Builder restClientBuilder() {
        return RestClient.builder();
    }

    @Bean("serviceRestClientBuilder")
    @LoadBalanced
    RestClient.Builder serviceRestClientBuilder(
            @Value("${lexorion.http.connect-timeout:2s}") Duration connectTimeout,
            @Value("${lexorion.http.read-timeout:3s}") Duration readTimeout) {
        SimpleClientHttpRequestFactory requests = new SimpleClientHttpRequestFactory();
        requests.setConnectTimeout(connectTimeout);
        requests.setReadTimeout(readTimeout);
        return RestClient.builder().requestFactory(requests);
    }
}
