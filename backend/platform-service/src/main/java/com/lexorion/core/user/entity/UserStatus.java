package com.lexorion.core.user.entity;

public enum UserStatus {
   ACTIVE,
   INACTIVE,
   LOCKED;

   // $FF: synthetic method
   private static UserStatus[] $values() {
      return new UserStatus[]{ACTIVE, INACTIVE, LOCKED};
   }
}
