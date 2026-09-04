package com.lexorion.platform.organization.config;

import com.lexorion.platform.organization.service.OrganizationService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class OrganizationSlugBackfill implements ApplicationRunner {
   private final OrganizationService organizationService;

   public OrganizationSlugBackfill(OrganizationService organizationService) {
      this.organizationService = organizationService;
   }

   public void run(ApplicationArguments args) {
      this.organizationService.backfillMissingSlugs();
   }
}
