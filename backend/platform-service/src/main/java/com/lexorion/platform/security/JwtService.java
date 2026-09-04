package com.lexorion.platform.security;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.time.Clock;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
   private final byte[] secret;
   private final SecurityProperties properties;
   private final Clock clock;

   public JwtService(SecurityProperties properties, Clock clock) {
      this.properties = properties;
      this.clock = clock;
      this.secret = properties.jwt().secret().getBytes(StandardCharsets.UTF_8);
      if (this.secret.length < 32) {
         throw new IllegalStateException("security.jwt.secret must be at least 32 bytes");
      }
   }

   public AccessToken issue(UUID userId, String email) {
      Instant issuedAt = this.clock.instant();
      Instant expiresAt = issuedAt.plus(this.properties.jwt().accessTokenTtl());
      JWTClaimsSet claims = (new JWTClaimsSet.Builder()).issuer(this.properties.jwt().issuer()).subject(userId.toString()).jwtID(UUID.randomUUID().toString()).issueTime(Date.from(issuedAt)).expirationTime(Date.from(expiresAt)).claim("email", email).claim("token_type", "access").build();
      SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);

      try {
         jwt.sign(new MACSigner(this.secret));
      } catch (JOSEException ex) {
         throw new IllegalStateException("Unable to sign access token", ex);
      }

      return new AccessToken(jwt.serialize(), expiresAt);
   }

   public UUID validateAndGetUserId(String token) {
      try {
         SignedJWT jwt = SignedJWT.parse(token);
         if (JWSAlgorithm.HS256.equals(jwt.getHeader().getAlgorithm()) && jwt.verify(new MACVerifier(this.secret))) {
            JWTClaimsSet claims = jwt.getJWTClaimsSet();
            if (this.properties.jwt().issuer().equals(claims.getIssuer()) && "access".equals(claims.getStringClaim("token_type")) && claims.getExpirationTime() != null && claims.getExpirationTime().toInstant().isAfter(this.clock.instant())) {
               return UUID.fromString(claims.getSubject());
            } else {
               throw invalidToken();
            }
         } else {
            throw invalidToken();
         }
      } catch (JOSEException | IllegalArgumentException | ParseException var4) {
         throw invalidToken();
      }
   }

   private static BadCredentialsException invalidToken() {
      return new BadCredentialsException("Access token is invalid or expired");
   }

   public static record AccessToken(String value, Instant expiresAt) {
   }
}
