package com.lexorion.core.security;
import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
@Configuration
@org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
@EnableConfigurationProperties(SecurityProperties.class)
public class CoreSecurityConfiguration {
   @Bean
   @org.springframework.core.annotation.Order(1)
   org.springframework.security.web.SecurityFilterChain coreSecurity(org.springframework.security.config.annotation.web.builders.HttpSecurity http,
         JwtService jwt, CoreIdentityService identities) throws Exception {
      return http.securityMatcher("/api/core/**")
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sessions -> sessions.sessionCreationPolicy(org.springframework.security.config.http.SessionCreationPolicy.STATELESS))
            .formLogin(form -> form.disable()).httpBasic(basic -> basic.disable())
            .exceptionHandling(errors -> errors.authenticationEntryPoint((request, response, error) -> CoreBearerFilter.error(response, 401, "Authentication is required"))
                  .accessDeniedHandler((request, response, error) -> CoreBearerFilter.error(response, 403, "Access denied")))
            .authorizeHttpRequests(requests -> requests.requestMatchers("/api/core/auth/login", "/api/core/auth/refresh", "/api/core/auth/logout").permitAll().anyRequest().authenticated())
            .addFilterBefore(new CoreBearerFilter(jwt, identities), org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class)
            .build();
   }

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

}
