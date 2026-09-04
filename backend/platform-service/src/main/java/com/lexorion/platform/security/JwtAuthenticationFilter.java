package com.lexorion.platform.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.web.filter.OncePerRequestFilter;

public class JwtAuthenticationFilter extends OncePerRequestFilter {
   private final JwtService jwtService;
   private final AuthenticatedUserService authenticatedUserService;
   private final AuthenticationEntryPoint authenticationEntryPoint;

   public JwtAuthenticationFilter(JwtService jwtService, AuthenticatedUserService authenticatedUserService, AuthenticationEntryPoint authenticationEntryPoint) {
      this.jwtService = jwtService;
      this.authenticatedUserService = authenticatedUserService;
      this.authenticationEntryPoint = authenticationEntryPoint;
   }

   protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
      String header = request.getHeader("Authorization");
      if (header != null && header.startsWith("Bearer ")) {
         try {
            AuthenticatedUser principal = this.authenticatedUserService.load(this.jwtService.validateAndGetUserId(header.substring(7)));
            List<SimpleGrantedAuthority> authorities = new ArrayList();
            authorities.add(new SimpleGrantedAuthority("AUTHENTICATED"));
            if (principal.platformAccess()) {
               authorities.add(new SimpleGrantedAuthority("PLATFORM_ACCESS"));
            }

            SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(principal, (Object)null, authorities));
            filterChain.doFilter(request, response);
         } catch (AuthenticationException ex) {
            SecurityContextHolder.clearContext();
            this.authenticationEntryPoint.commence(request, response, ex);
         }

      } else {
         filterChain.doFilter(request, response);
      }
   }
}
