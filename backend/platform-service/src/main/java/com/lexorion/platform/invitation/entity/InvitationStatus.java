package com.lexorion.platform.invitation.entity;

public enum InvitationStatus {
   PENDING,
   ACCEPTED,
   EXPIRED,
   REVOKED;

   // $FF: synthetic method
   private static InvitationStatus[] $values() {
      return new InvitationStatus[]{PENDING, ACCEPTED, EXPIRED, REVOKED};
   }
}
