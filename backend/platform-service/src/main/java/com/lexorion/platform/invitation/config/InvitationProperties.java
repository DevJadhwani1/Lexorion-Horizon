package com.lexorion.platform.invitation.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(
   prefix = "lexorion.invitations"
)
public record InvitationProperties(Duration ttl) {
   public InvitationProperties(Duration ttl) {
      if (ttl == null || ttl.isZero() || ttl.isNegative()) {
         ttl = Duration.ofDays(7L);
      }

      this.ttl = ttl;
   }
}
