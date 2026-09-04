package com.lexorion.platform.security;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(
   prefix = "security"
)
public record SecurityProperties(Jwt jwt, Duration refreshTokenTtl) {
   public static record Jwt(String secret, String issuer, Duration accessTokenTtl) {
   }
}
