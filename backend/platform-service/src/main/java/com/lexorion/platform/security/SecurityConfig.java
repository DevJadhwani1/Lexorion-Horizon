package com.lexorion.platform.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexorion.platform.domain.config.DomainProperties;
import com.lexorion.platform.domain.context.OrganizationContextHolder;
import com.lexorion.platform.domain.filter.OrganizationContextFilter;
import com.lexorion.platform.domain.filter.SharedPlatformOrganizationContextFilter;
import com.lexorion.platform.domain.service.HostnameNormalizer;
import com.lexorion.platform.domain.service.OrganizationContextResolver;
import com.lexorion.platform.domain.service.RequestHostnameExtractor;
import com.lexorion.platform.domain.service.SharedPlatformOrganizationResolver;
import com.lexorion.platform.invitation.config.InvitationProperties;
import com.lexorion.platform.tenantaccess.context.TenantAccessContextHolder;
import com.lexorion.platform.tenantaccess.filter.TenantAccessContextFilter;
import com.lexorion.platform.tenantaccess.service.TenantAccessContextResolver;
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
   Clock clock() {
      return Clock.systemUTC();
   }

   @Bean
   PasswordEncoder passwordEncoder() {
      Map<String, PasswordEncoder> encoders = new HashMap();
      encoders.put("bcrypt", new BCryptPasswordEncoder());
      DelegatingPasswordEncoder encoder = new DelegatingPasswordEncoder("bcrypt", encoders);
      encoder.setDefaultPasswordEncoderForMatches(new LegacyPbkdf2PasswordEncoder());
      return encoder;
   }

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
   SecurityFilterChain securityFilterChain(HttpSecurity http, JwtAuthenticationFilter jwtAuthenticationFilter, OrganizationContextFilter organizationContextFilter, SharedPlatformOrganizationContextFilter sharedOrganizationContextFilter, TenantAccessContextFilter tenantAccessContextFilter, AuthenticationEntryPoint entryPoint, AccessDeniedHandler deniedHandler) throws Exception {
      return (SecurityFilterChain)http.csrf((csrf) -> csrf.disable()).sessionManagement((session) -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)).formLogin((form) -> form.disable()).httpBasic((basic) -> basic.disable()).exceptionHandling((errors) -> errors.authenticationEntryPoint(entryPoint).accessDeniedHandler(deniedHandler)).authorizeHttpRequests((requests) -> ((AuthorizeHttpRequestsConfigurer.AuthorizedUrl)((AuthorizeHttpRequestsConfigurer.AuthorizedUrl)requests.requestMatchers(new String[]{"/api/platform/auth/**", "/actuator/health", "/actuator/info"})).permitAll().anyRequest()).authenticated()).addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class).addFilterBefore(organizationContextFilter, JwtAuthenticationFilter.class).addFilterAfter(sharedOrganizationContextFilter, JwtAuthenticationFilter.class).addFilterAfter(tenantAccessContextFilter, SharedPlatformOrganizationContextFilter.class).build();
   }
}
