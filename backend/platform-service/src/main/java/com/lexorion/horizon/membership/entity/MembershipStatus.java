package com.lexorion.horizon.membership.entity;

public enum MembershipStatus {
   ACTIVE,
   INACTIVE,
   SUSPENDED;

   // $FF: synthetic method
   private static MembershipStatus[] $values() {
      return new MembershipStatus[]{ACTIVE, INACTIVE, SUSPENDED};
   }
}
