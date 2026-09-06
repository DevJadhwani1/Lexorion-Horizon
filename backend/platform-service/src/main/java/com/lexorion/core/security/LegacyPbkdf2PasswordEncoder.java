package com.lexorion.core.security;

import java.security.MessageDigest;
import java.security.spec.KeySpec;
import java.util.Base64;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import org.springframework.security.crypto.password.PasswordEncoder;

final class LegacyPbkdf2PasswordEncoder implements PasswordEncoder {
   public String encode(CharSequence rawPassword) {
      throw new UnsupportedOperationException("Legacy hashes must not be created");
   }

   public boolean matches(CharSequence rawPassword, String encodedPassword) {
      try {
         String[] parts = encodedPassword.split(":", -1);
         if (parts.length == 4 && "pbkdf2".equals(parts[0])) {
            int iterations = Integer.parseInt(parts[1]);
            if (iterations >= 1 && iterations <= 2000000) {
               byte[] salt = Base64.getDecoder().decode(parts[2]);
               byte[] expected = Base64.getDecoder().decode(parts[3]);
               KeySpec spec = new PBEKeySpec(rawPassword.toString().toCharArray(), salt, iterations, expected.length * 8);
               byte[] actual = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
               return MessageDigest.isEqual(expected, actual);
            } else {
               return false;
            }
         } else {
            return false;
         }
      } catch (Exception var9) {
         return false;
      }
   }
}
