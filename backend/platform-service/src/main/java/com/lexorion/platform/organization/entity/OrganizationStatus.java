package com.lexorion.platform.organization.entity;

public enum OrganizationStatus {
   PENDING,
   TRIAL,
   ACTIVE,
   SUSPENDED,
   CANCELLED,
   /** @deprecated */
   @Deprecated
   TERMINATED;

   public boolean allowsTenantManagement() {
      return this == TRIAL || this == ACTIVE;
   }

   public boolean allowsTenantAccess() {
      return this == TRIAL || this == ACTIVE;
   }

   // $FF: synthetic method
   private static OrganizationStatus[] $values() {
      return new OrganizationStatus[]{PENDING, TRIAL, ACTIVE, SUSPENDED, CANCELLED, TERMINATED};
   }
}
