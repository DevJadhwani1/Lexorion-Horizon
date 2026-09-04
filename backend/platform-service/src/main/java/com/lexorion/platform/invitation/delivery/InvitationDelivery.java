package com.lexorion.platform.invitation.delivery;

import java.time.Instant;

public interface InvitationDelivery {
   void deliver(InvitationMessage message);

   public static record InvitationMessage(String recipientEmail, String organizationName, String organizationSlug, String rawToken, Instant expiresAt) {
   }
}
