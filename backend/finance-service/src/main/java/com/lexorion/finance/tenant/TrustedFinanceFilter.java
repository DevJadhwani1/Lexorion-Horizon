package com.lexorion.finance.tenant;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Establishes the Platform-validated workspace and role for every Finance API request. */
@Component
public class TrustedFinanceFilter extends OncePerRequestFilter {
    public static final String WORKSPACE_HEADER = "X-Lexorion-Workspace";
    private final FinanceAuthorityClient authority;
    private final TrustedFinanceContextHolder contexts;

    public TrustedFinanceFilter(FinanceAuthorityClient authority, TrustedFinanceContextHolder contexts) {
        this.authority = authority;
        this.contexts = contexts;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/finance/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = request.getHeader(HttpHeaders.AUTHORIZATION), key = request.getHeader(WORKSPACE_HEADER);
        if (token == null || !token.startsWith("Bearer ") || key == null
                || !key.matches("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")) {
            response.sendError(401, "Trusted Finance context is required");
            return;
        }
        TrustedFinanceContext context;
        try {
            context = authority.validate(key, token, request.getHeader(HttpHeaders.HOST), request.getHeader("X-Lexorion-Organization"));
        } catch (RuntimeException denied) {
            response.sendError(403, "Finance workspace access denied");
            return;
        }
        if (context == null || !key.equals(context.workspaceKey())) {
            response.sendError(403, "Finance workspace access denied");
            return;
        }
        try {
            contexts.set(context);
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                    context.workspaceKey(), null, List.of(new SimpleGrantedAuthority("ROLE_" + context.role()))));
            chain.doFilter(request, response);
        } finally {
            contexts.clear();
            SecurityContextHolder.clearContext();
        }
    }
}
