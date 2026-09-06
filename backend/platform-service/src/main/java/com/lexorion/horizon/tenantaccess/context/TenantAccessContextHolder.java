package com.lexorion.horizon.tenantaccess.context;

import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class TenantAccessContextHolder {
   private final ThreadLocal<TenantAccessContext> current = new ThreadLocal();

   public Optional<TenantAccessContext> get() {
      return Optional.ofNullable((TenantAccessContext)this.current.get());
   }

   public void set(TenantAccessContext context) {
      this.current.set(context);
   }

   public void clear() {
      this.current.remove();
   }
}
