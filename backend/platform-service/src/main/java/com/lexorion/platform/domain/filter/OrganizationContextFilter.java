package com.lexorion.platform.domain.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexorion.platform.domain.context.OrganizationContextHolder;
import com.lexorion.platform.domain.exception.InvalidHostnameException;
import com.lexorion.platform.domain.exception.TenantHostnameUnavailableException;
import com.lexorion.platform.domain.service.OrganizationContextResolver;
import com.lexorion.platform.domain.service.RequestHostnameExtractor;
import com.lexorion.platform.exception.ApiError;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Objects;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.web.filter.OncePerRequestFilter;

public class OrganizationContextFilter extends OncePerRequestFilter {
   private final RequestHostnameExtractor hostnameExtractor;
   private final OrganizationContextResolver contextResolver;
   private final OrganizationContextHolder contextHolder;
   private final ObjectMapper objectMapper;

   public OrganizationContextFilter(RequestHostnameExtractor hostnameExtractor, OrganizationContextResolver contextResolver, OrganizationContextHolder contextHolder, ObjectMapper objectMapper) {
      this.hostnameExtractor = hostnameExtractor;
      this.contextResolver = contextResolver;
      this.contextHolder = contextHolder;
      this.objectMapper = objectMapper;
   }

   protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
      this.contextHolder.clear();

      try {
         Optional<com.lexorion.platform.domain.context.OrganizationContext> resolved =
               this.hostnameExtractor.extract(request).flatMap(this.contextResolver::resolve);
         resolved.ifPresent(this.contextHolder::set);
         filterChain.doFilter(request, response);
      } catch (InvalidHostnameException var9) {
         this.writeError(request, response, HttpStatus.BAD_REQUEST, "Request Host header is invalid");
      } catch (TenantHostnameUnavailableException ex) {
         this.writeError(request, response, HttpStatus.MISDIRECTED_REQUEST, ex.getMessage());
      } finally {
         this.contextHolder.clear();
      }

   }

   protected boolean shouldNotFilterAsyncDispatch() {
      return true;
   }

   private void writeError(HttpServletRequest request, HttpServletResponse response, HttpStatus status, String message) throws IOException {
      response.setStatus(status.value());
      response.setContentType("application/json");
      this.objectMapper.writeValue(response.getOutputStream(), ApiError.of(status.value(), status.getReasonPhrase(), message, request.getRequestURI()));
   }
}
