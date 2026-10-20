package com.lexorion.platform.audit;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class AuditWebConfiguration implements WebMvcConfigurer {
   private final AdministrativeAuditInterceptor audit;

   public AuditWebConfiguration(AdministrativeAuditInterceptor audit) {
      this.audit = audit;
   }

   @Override
   public void addInterceptors(InterceptorRegistry registry) {
      registry.addInterceptor(this.audit);
   }
}
