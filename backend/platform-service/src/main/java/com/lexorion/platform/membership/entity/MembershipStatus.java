package com.lexorion.platform.membership.entity;

public enum MembershipStatus {
   ACTIVE,
   INACTIVE,
   SUSPENDED;

   // $FF: synthetic method
   private static MembershipStatus[] $values() {
      return new MembershipStatus[]{ACTIVE, INACTIVE, SUSPENDED};
   }
}
