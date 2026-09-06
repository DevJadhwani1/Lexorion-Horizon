package com.lexorion.workforce.tenant;

import jakarta.servlet.*;import jakarta.servlet.http.*;import java.io.IOException;import java.nio.charset.StandardCharsets;import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;import org.springframework.stereotype.Component;import org.springframework.web.filter.OncePerRequestFilter;

@Component public class PayrollServiceIdentityFilter extends OncePerRequestFilter {
 public static final String HEADER="X-Lexorion-Service-Token";private final byte[] token;
 public PayrollServiceIdentityFilter(@Value("${lexorion.service-auth.payroll-token}")String token){if(token==null||token.length()<32)throw new IllegalStateException("Payroll service token must be at least 32 characters");this.token=token.getBytes(StandardCharsets.UTF_8);}
 @Override protected boolean shouldNotFilter(HttpServletRequest r){return !r.getRequestURI().startsWith("/internal/workforce/");}
 @Override protected void doFilterInternal(HttpServletRequest r,HttpServletResponse s,FilterChain c)throws ServletException,IOException{String supplied=r.getHeader(HEADER);if(supplied==null||!MessageDigest.isEqual(token,supplied.getBytes(StandardCharsets.UTF_8))){s.sendError(401,"Authenticated Payroll service identity is required");return;}c.doFilter(r,s);}
}
