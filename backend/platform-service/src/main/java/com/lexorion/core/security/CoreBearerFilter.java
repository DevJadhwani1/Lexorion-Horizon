package com.lexorion.core.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

final class CoreBearerFilter extends OncePerRequestFilter {
    private final JwtService jwt;
    private final CoreIdentityService identities;
    CoreBearerFilter(JwtService jwt, CoreIdentityService identities) { this.jwt = jwt; this.identities = identities; }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                var identity = identities.load(jwt.validateAndGetUserId(header.substring(7)));
                var authorities = identity.coreOperator() ? List.of(new SimpleGrantedAuthority("CORE_OPERATOR")) : List.<SimpleGrantedAuthority>of();
                SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(identity, null, authorities));
            } catch (AuthenticationException invalid) {
                SecurityContextHolder.clearContext(); error(response, 401, "Access token is invalid or expired"); return;
            }
        }
        chain.doFilter(request, response);
    }
    static void error(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status); response.setContentType("application/json");
        response.getWriter().write("{\"status\":" + status + ",\"message\":\"" + message + "\"}");
    }
}
