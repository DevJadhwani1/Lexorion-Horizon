package com.lexorion.platform.domain.entity;

public enum DomainVerificationStatus {
   PENDING,
   VERIFIED,
   FAILED;

   // $FF: synthetic method
   private static DomainVerificationStatus[] $values() {
      return new DomainVerificationStatus[]{PENDING, VERIFIED, FAILED};
   }
}
