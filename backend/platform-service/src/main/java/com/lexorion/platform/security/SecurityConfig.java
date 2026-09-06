package com.lexorion.platform.security;
import com.lexorion.core.security.JwtService;
import com.lexorion.core.security.SecurityProperties;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexorion.platform.domain.config.DomainProperties;
import com.lexorion.platform.domain.context.OrganizationContextHolder;
import com.lexorion.platform.domain.filter.OrganizationContextFilter;
import com.lexorion.platform.domain.filter.SharedPlatformOrganizationContextFilter;
import com.lexorion.platform.domain.service.HostnameNormalizer;
import com.lexorion.platform.domain.service.OrganizationContextResolver;
import com.lexorion.platform.domain.service.RequestHostnameExtractor;
import com.lexorion.platform.domain.service.SharedPlatformOrganizationResolver;
import com.lexorion.horizon.invitation.config.InvitationProperties;
import com.lexorion.horizon.tenantaccess.context.TenantAccessContextHolder;
import com.lexorion.horizon.tenantaccess.filter.TenantAccessContextFilter;
import com.lexorion.horizon.tenantaccess.service.TenantAccessContextResolver;
import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AuthorizeHttpRequestsConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableMethodSecurity
@EnableConfigurationProperties({SecurityProperties.class, DomainProperties.class, InvitationProperties.class})
public class SecurityConfig {
   @Bean
   AuthenticationEntryPoint authenticationEntryPoint(ObjectMapper objectMapper) {
      return new JsonAuthenticationEntryPoint(objectMapper);
   }

   @Bean
   AccessDeniedHandler accessDeniedHandler(ObjectMapper objectMapper) {
      return new JsonAccessDeniedHandler(objectMapper);
   }

   @Bean
   JwtAuthenticationFilter jwtAuthenticationFilter(JwtService jwtService, AuthenticatedUserService authenticatedUserService, AuthenticationEntryPoint authenticationEntryPoint) {
      return new JwtAuthenticationFilter(jwtService, authenticatedUserService, authenticationEntryPoint);
   }

   @Bean
   OrganizationContextFilter organizationContextFilter(RequestHostnameExtractor hostnameExtractor, OrganizationContextResolver contextResolver, OrganizationContextHolder contextHolder, ObjectMapper objectMapper) {
      return new OrganizationContextFilter(hostnameExtractor, contextResolver, contextHolder, objectMapper);
   }

   @Bean
   TenantAccessContextFilter tenantAccessContextFilter(TenantAccessContextResolver contextResolver, TenantAccessContextHolder contextHolder) {
      return new TenantAccessContextFilter(contextResolver, contextHolder);
   }

   @Bean
   SharedPlatformOrganizationContextFilter sharedPlatformOrganizationContextFilter(RequestHostnameExtractor hostnameExtractor, SharedPlatformOrganizationResolver organizationResolver, OrganizationContextHolder contextHolder, ObjectMapper objectMapper, DomainProperties properties, HostnameNormalizer hostnameNormalizer) {
      return new SharedPlatformOrganizationContextFilter(hostnameExtractor, organizationResolver, contextHolder, objectMapper, properties, hostnameNormalizer);
   }

   @Bean
   SecurityFilterChain securityFilterChain(HttpSecurity http, JwtAuthenticationFilter jwtAuthenticationFilter, OrganizationContextFilter organizationContextFilter, SharedPlatformOrganizationContextFilter sharedOrganizationContextFilter, TenantAccessContextFilter tenantAccessContextFilter, InternalServiceIdentityFilter serviceIdentityFilter, AuthenticationEntryPoint entryPoint, AccessDeniedHandler deniedHandler) throws Exception {
      return (SecurityFilterChain)http.csrf((csrf) -> csrf.disable()).sessionManagement((session) -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)).formLogin((form) -> form.disable()).httpBasic((basic) -> basic.disable()).exceptionHandling((errors) -> errors.authenticationEntryPoint(entryPoint).accessDeniedHandler(deniedHandler)).authorizeHttpRequests((requests) -> ((AuthorizeHttpRequestsConfigurer.AuthorizedUrl)((AuthorizeHttpRequestsConfigurer.AuthorizedUrl)requests.requestMatchers(new String[]{"/api/core/auth/login", "/api/core/auth/refresh", "/api/core/auth/logout", "/api/platform/auth/login", "/api/platform/auth/refresh", "/api/platform/auth/logout", "/actuator/health", "/actuator/info"})).permitAll().anyRequest()).authenticated()).addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class).addFilterBefore(organizationContextFilter, JwtAuthenticationFilter.class).addFilterBefore(serviceIdentityFilter, OrganizationContextFilter.class).addFilterAfter(sharedOrganizationContextFilter, JwtAuthenticationFilter.class).addFilterAfter(tenantAccessContextFilter, SharedPlatformOrganizationContextFilter.class).build();
   }
}
