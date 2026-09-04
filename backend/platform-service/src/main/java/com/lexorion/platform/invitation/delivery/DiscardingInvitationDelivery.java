package com.lexorion.platform.invitation.delivery;

import org.springframework.stereotype.Component;

@Component
public class DiscardingInvitationDelivery implements InvitationDelivery {
   public void deliver(InvitationDelivery.InvitationMessage message) {
   }
}
