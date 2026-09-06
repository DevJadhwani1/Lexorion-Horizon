package com.lexorion.platform.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class InternalServiceIdentityFilter extends OncePerRequestFilter {
    public static final String HEADER = "X-Lexorion-Service-Token";
    private final byte[] workforceToken;
    private final byte[] payrollToken;

    public InternalServiceIdentityFilter(@Value("${lexorion.service-auth.workforce-token}") String workforceToken,
            @Value("${lexorion.service-auth.payroll-token}") String payrollToken) {
        this.workforceToken = require(workforceToken);
        this.payrollToken = require(payrollToken);
    }

    @Override protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/internal/");
    }

    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        byte[] expected = request.getRequestURI().startsWith("/internal/workforce/") ? workforceToken
                : request.getRequestURI().startsWith("/internal/payroll/") ? payrollToken : null;
        String supplied = request.getHeader(HEADER);
        if (expected == null || supplied == null
                || !MessageDigest.isEqual(expected, supplied.getBytes(StandardCharsets.UTF_8))) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Authenticated service identity is required");
            return;
        }
        chain.doFilter(request, response);
    }

    private static byte[] require(String value) {
        if (value == null || value.length() < 32) throw new IllegalStateException("Service tokens must be at least 32 characters");
        return value.getBytes(StandardCharsets.UTF_8);
    }
}
