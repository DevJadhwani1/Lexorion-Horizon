package com.lexorion.horizon.tenantaccess.service;

import com.lexorion.horizon.membership.entity.OrganizationRole;
import com.lexorion.platform.security.AuthenticatedUser;
import com.lexorion.horizon.tenantaccess.context.TenantAccessContextHolder;
import java.util.Arrays;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component("tenantAuthorization")
public class TenantAuthorization {
   private final TenantAccessContextHolder tenantAccessContextHolder;

   public TenantAuthorization(TenantAccessContextHolder tenantAccessContextHolder) {
      this.tenantAccessContextHolder = tenantAccessContextHolder;
   }

   public boolean hasTenantAccess() {
      return this.tenantAccessContextHolder.get().isPresent();
   }

   public boolean hasRole(OrganizationRole role) {
      return (Boolean)this.tenantAccessContextHolder.get().map((context) -> context.membershipRole() == role).orElse(false);
   }

   public boolean hasAnyRole(OrganizationRole... roles) {
      return (Boolean)this.tenantAccessContextHolder.get().map((context) -> Arrays.stream(roles).anyMatch((role) -> role == context.membershipRole())).orElse(false);
   }

   public boolean isPlatformAuthority() {
      Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
      boolean var10000;
      if (authentication != null && authentication.isAuthenticated()) {
         Object var3 = authentication.getPrincipal();
         if (var3 instanceof AuthenticatedUser) {
            AuthenticatedUser user = (AuthenticatedUser)var3;
            if (user.platformAccess()) {
               var10000 = true;
               return var10000;
            }
         }
      }

      var10000 = false;
      return var10000;
   }
}
