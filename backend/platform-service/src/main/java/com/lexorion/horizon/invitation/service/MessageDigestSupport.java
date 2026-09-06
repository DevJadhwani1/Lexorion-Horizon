package com.lexorion.horizon.invitation.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

final class MessageDigestSupport {
   private MessageDigestSupport() {
   }

   static boolean constantTimeEquals(String left, String right) {
      return MessageDigest.isEqual(left.getBytes(StandardCharsets.UTF_8), right.getBytes(StandardCharsets.UTF_8));
   }
}
