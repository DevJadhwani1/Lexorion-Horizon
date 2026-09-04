package com.lexorion.platform.domain.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(
   prefix = "lexorion.domains"
)
public class DomainProperties {
   private String sharedPlatformHostname;

   public String getSharedPlatformHostname() {
      return this.sharedPlatformHostname;
   }

   public void setSharedPlatformHostname(String sharedPlatformHostname) {
      this.sharedPlatformHostname = sharedPlatformHostname;
   }
}
