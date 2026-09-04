package com.lexorion.platform.security;

import java.security.Principal;
import java.util.Map;
import java.util.UUID;

public record AuthenticatedUser(UUID userId, String email, Map<UUID, OrganizationAuthority> organizations, boolean platformAccess) implements Principal {
   public AuthenticatedUser(UUID userId, String email, Map<UUID, OrganizationAuthority> organizations, boolean platformAccess) {
      organizations = Map.copyOf(organizations);
      this.userId = userId;
      this.email = email;
      this.organizations = organizations;
      this.platformAccess = platformAccess;
   }

   public String getName() {
      return this.userId.toString();
   }
}
