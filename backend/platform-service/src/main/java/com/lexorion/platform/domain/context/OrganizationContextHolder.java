package com.lexorion.platform.domain.context;

import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class OrganizationContextHolder {
   private final ThreadLocal<OrganizationContext> current = new ThreadLocal();

   public Optional<OrganizationContext> get() {
      return Optional.ofNullable((OrganizationContext)this.current.get());
   }

   public void set(OrganizationContext context) {
      this.current.set(context);
   }

   public void clear() {
      this.current.remove();
   }
}
