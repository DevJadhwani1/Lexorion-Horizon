package com.lexorion.platform.domain.entity;

public enum DomainType {
   PLATFORM_SUBDOMAIN,
   CUSTOM_SUBDOMAIN,
   CUSTOM_DOMAIN;

   // $FF: synthetic method
   private static DomainType[] $values() {
      return new DomainType[]{PLATFORM_SUBDOMAIN, CUSTOM_SUBDOMAIN, CUSTOM_DOMAIN};
   }
}
