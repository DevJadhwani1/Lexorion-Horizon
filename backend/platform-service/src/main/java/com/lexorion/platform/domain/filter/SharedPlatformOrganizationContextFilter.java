package com.lexorion.platform.domain.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lexorion.platform.domain.config.DomainProperties;
import com.lexorion.platform.domain.context.OrganizationContext;
import com.lexorion.platform.domain.context.OrganizationContextHolder;
import com.lexorion.platform.domain.exception.InvalidOrganizationSelectionException;
import com.lexorion.platform.domain.exception.OrganizationSelectionDeniedException;
import com.lexorion.platform.domain.service.HostnameNormalizer;
import com.lexorion.platform.domain.service.RequestHostnameExtractor;
import com.lexorion.platform.domain.service.SharedPlatformOrganizationResolver;
import com.lexorion.platform.exception.ApiError;
import com.lexorion.platform.organization.exception.InvalidTenantSlugException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.web.filter.OncePerRequestFilter;

public class SharedPlatformOrganizationContextFilter extends OncePerRequestFilter {
   public static final String ORGANIZATION_HEADER = "X-Lexorion-Organization";
   private final RequestHostnameExtractor hostnameExtractor;
   private final SharedPlatformOrganizationResolver organizationResolver;
   private final OrganizationContextHolder contextHolder;
   private final ObjectMapper objectMapper;
   private final String sharedPlatformHostname;

   public SharedPlatformOrganizationContextFilter(RequestHostnameExtractor hostnameExtractor, SharedPlatformOrganizationResolver organizationResolver, OrganizationContextHolder contextHolder, ObjectMapper objectMapper, DomainProperties properties, HostnameNormalizer hostnameNormalizer) {
      this.hostnameExtractor = hostnameExtractor;
      this.organizationResolver = organizationResolver;
      this.contextHolder = contextHolder;
      this.objectMapper = objectMapper;
      this.sharedPlatformHostname = hostnameNormalizer.normalize(properties.getSharedPlatformHostname());
   }

   protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
      boolean establishedSharedContext = false;

      try {
         String selection = request.getHeader("X-Lexorion-Organization");
         Optional<OrganizationContext> hostnameContext = this.contextHolder.get();
         if (hostnameContext.isPresent()) {
            this.rejectConflictingWhiteLabelSelection(selection, (OrganizationContext)hostnameContext.get());
         } else if (selection != null) {
            if (!this.isSharedPlatformRequest(request)) {
               throw new InvalidOrganizationSelectionException("Organization selection header is only accepted on the shared platform host");
            }

            Optional<OrganizationContext> selected = this.organizationResolver.resolveCurrent(selection, this.sharedPlatformHostname);
            if (selected.isPresent()) {
               this.contextHolder.set((OrganizationContext)selected.get());
               establishedSharedContext = true;
            }
         }

         filterChain.doFilter(request, response);
      } catch (InvalidTenantSlugException | InvalidOrganizationSelectionException ex) {
         this.writeError(request, response, HttpStatus.BAD_REQUEST, ((RuntimeException)ex).getMessage());
      } catch (OrganizationSelectionDeniedException ex) {
         this.writeError(request, response, HttpStatus.FORBIDDEN, ex.getMessage());
      } finally {
         if (establishedSharedContext) {
            this.contextHolder.clear();
         }

      }

   }

   private void rejectConflictingWhiteLabelSelection(String selection, OrganizationContext hostnameContext) {
      if (selection != null && !this.organizationResolver.normalizeSelection(selection).equals(hostnameContext.organizationSlug())) {
         throw new InvalidOrganizationSelectionException("Organization selection conflicts with the hostname-derived organization");
      }
   }

   private boolean isSharedPlatformRequest(HttpServletRequest request) {
      Optional<String> hostname = this.hostnameExtractor.extract(request);
      if (hostname.isPresent()) {
         return this.sharedPlatformHostname.equals(hostname.get());
      } else {
         String host = request.getHeader("Host");
         String directHost = host == null ? request.getServerName() : host;
         return directHost != null && directHost.trim().toLowerCase().matches("(?:localhost|127\\.0\\.0\\.1)(?::\\d+)?");
      }
   }

   private void writeError(HttpServletRequest request, HttpServletResponse response, HttpStatus status, String message) throws IOException {
      response.setStatus(status.value());
      response.setContentType("application/json");
      this.objectMapper.writeValue(response.getOutputStream(), ApiError.of(status.value(), status.getReasonPhrase(), message, request.getRequestURI()));
   }
}
