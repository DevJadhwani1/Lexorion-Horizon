package com.lexorion.platform.bootstrap;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Local-only identity used to exercise the running stack. It is off unless two explicit settings are present,
 * and it refuses a production environment. It never replaces a password that is already stored.
 */
@ConfigurationProperties(prefix = "lexorion.qa-identity")
public class LocalQaIdentityProperties {
   private boolean enabled;
   private String acknowledgment = "";
   private String environment = "local";
   private String email = "qa-lifecycle@lexorion.test";
   private String password = "";
   private String firstName = "QA";
   private String lastName = "Lifecycle";
   private String organizationSlug = "lexorion-client";

   public boolean isEnabled() { return this.enabled; }
   public void setEnabled(boolean enabled) { this.enabled = enabled; }
   public String getAcknowledgment() { return this.acknowledgment; }
   public void setAcknowledgment(String acknowledgment) { this.acknowledgment = acknowledgment; }
   public String getEnvironment() { return this.environment; }
   public void setEnvironment(String environment) { this.environment = environment; }
   public String getEmail() { return this.email; }
   public void setEmail(String email) { this.email = email; }
   public String getPassword() { return this.password; }
   public void setPassword(String password) { this.password = password; }
   public String getFirstName() { return this.firstName; }
   public void setFirstName(String firstName) { this.firstName = firstName; }
   public String getLastName() { return this.lastName; }
   public void setLastName(String lastName) { this.lastName = lastName; }
   public String getOrganizationSlug() { return this.organizationSlug; }
   public void setOrganizationSlug(String organizationSlug) { this.organizationSlug = organizationSlug; }
}
