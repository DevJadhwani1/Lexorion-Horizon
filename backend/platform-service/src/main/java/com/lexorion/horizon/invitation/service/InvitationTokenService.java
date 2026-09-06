package com.lexorion.horizon.invitation.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.stereotype.Component;

@Component
public class InvitationTokenService {
   private final SecureRandom secureRandom = new SecureRandom();

   public String generate() {
      byte[] bytes = new byte[32];
      this.secureRandom.nextBytes(bytes);
      return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
   }

   public String hash(String rawToken) {
      try {
         return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(rawToken.getBytes(StandardCharsets.UTF_8)));
      } catch (NoSuchAlgorithmException ex) {
         throw new IllegalStateException("SHA-256 is unavailable", ex);
      }
   }
}
