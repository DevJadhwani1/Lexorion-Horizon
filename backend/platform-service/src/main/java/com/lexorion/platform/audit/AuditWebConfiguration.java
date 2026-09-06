package com.lexorion.platform.audit;
import com.lexorion.core.audit.AuditRecorder;
import org.springframework.context.annotation.Configuration;import org.springframework.web.servlet.config.annotation.*;
@Configuration public class AuditWebConfiguration implements WebMvcConfigurer{private final AdministrativeAuditInterceptor audit;public AuditWebConfiguration(AdministrativeAuditInterceptor audit){this.audit=audit;}@Override public void addInterceptors(InterceptorRegistry registry){registry.addInterceptor(audit);}}
