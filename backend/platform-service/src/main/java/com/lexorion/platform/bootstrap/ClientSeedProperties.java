package com.lexorion.platform.bootstrap;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "lexorion.client-seed")
public class ClientSeedProperties {
   private boolean enabled;
   private String email = "dev@lexorion.in";
   private String password;
   private String firstName = "Dev";
   private String lastName = "Jadhwani";
   private String organizationName = "Lexorion Client";
   private String organizationCode = "LEXORION-CLIENT";
   private String organizationSlug = "lexorion-client";

   public boolean isEnabled() {
      return this.enabled;
   }

   public void setEnabled(boolean enabled) {
      this.enabled = enabled;
   }

   public String getEmail() {
      return this.email;
   }

   public void setEmail(String email) {
      this.email = email;
   }

   public String getPassword() {
      return this.password;
   }

   public void setPassword(String password) {
      this.password = password;
   }

   public String getFirstName() {
      return this.firstName;
   }

   public void setFirstName(String firstName) {
      this.firstName = firstName;
   }

   public String getLastName() {
      return this.lastName;
   }

   public void setLastName(String lastName) {
      this.lastName = lastName;
   }

   public String getOrganizationName() {
      return this.organizationName;
   }

   public void setOrganizationName(String organizationName) {
      this.organizationName = organizationName;
   }

   public String getOrganizationCode() {
      return this.organizationCode;
   }

   public void setOrganizationCode(String organizationCode) {
      this.organizationCode = organizationCode;
   }

   public String getOrganizationSlug() {
      return this.organizationSlug;
   }

   public void setOrganizationSlug(String organizationSlug) {
      this.organizationSlug = organizationSlug;
   }
}
