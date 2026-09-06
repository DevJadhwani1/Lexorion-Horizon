package com.lexorion.workforce.config;
import com.lexorion.workforce.tenant.TrustedTenantFilter;
import com.lexorion.workforce.tenant.PayrollServiceIdentityFilter;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
@Configuration @EnableMethodSecurity public class SecurityConfig {
    @Bean SecurityFilterChain security(HttpSecurity http,TrustedTenantFilter filter,PayrollServiceIdentityFilter serviceIdentityFilter)throws Exception{return http.csrf(c->c.disable()).sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS)).formLogin(f->f.disable()).httpBasic(b->b.disable()).authorizeHttpRequests(a->a.requestMatchers("/actuator/health","/v3/api-docs/**","/swagger-ui/**","/swagger-ui.html").permitAll().anyRequest().authenticated()).addFilterBefore(filter, AnonymousAuthenticationFilter.class).addFilterBefore(serviceIdentityFilter,TrustedTenantFilter.class).build();}
}
