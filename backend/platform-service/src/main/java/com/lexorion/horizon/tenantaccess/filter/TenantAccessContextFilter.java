package com.lexorion.horizon.tenantaccess.filter;

import com.lexorion.horizon.tenantaccess.context.TenantAccessContextHolder;
import com.lexorion.horizon.tenantaccess.service.TenantAccessContextResolver;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Objects;
import java.util.Optional;
import org.springframework.web.filter.OncePerRequestFilter;

public class TenantAccessContextFilter extends OncePerRequestFilter {
   private final TenantAccessContextResolver contextResolver;
   private final TenantAccessContextHolder contextHolder;

   public TenantAccessContextFilter(TenantAccessContextResolver contextResolver, TenantAccessContextHolder contextHolder) {
      this.contextResolver = contextResolver;
      this.contextHolder = contextHolder;
   }

   protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
      this.contextHolder.clear();

      try {
         Optional<com.lexorion.horizon.tenantaccess.context.TenantAccessContext> resolved = this.contextResolver.resolveCurrent();
         resolved.ifPresent(this.contextHolder::set);
         filterChain.doFilter(request, response);
      } finally {
         this.contextHolder.clear();
      }

   }

   protected boolean shouldNotFilterAsyncDispatch() {
      return true;
   }
}
