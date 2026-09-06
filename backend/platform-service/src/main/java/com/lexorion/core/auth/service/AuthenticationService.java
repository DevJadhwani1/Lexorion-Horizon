package com.lexorion.core.auth.service;

import com.lexorion.core.auth.dto.LoginRequest;
import com.lexorion.core.auth.dto.TokenResponse;
import com.lexorion.core.auth.entity.RefreshToken;
import com.lexorion.core.auth.exception.InvalidCredentialsException;
import com.lexorion.core.auth.exception.InvalidRefreshTokenException;
import com.lexorion.core.auth.repository.RefreshTokenRepository;
import com.lexorion.core.security.JwtService;
import com.lexorion.core.security.SecurityProperties;
import com.lexorion.core.user.entity.User;
import com.lexorion.core.user.entity.UserStatus;
import com.lexorion.core.user.repository.UserRepository;
import com.lexorion.core.audit.AuditRecorder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import io.micrometer.core.instrument.MeterRegistry;

@Service
@Transactional
public class AuthenticationService {
   private static final String DUMMY_HASH = "{bcrypt}$2a$10$7EqJtq98hPqEX7fNZaFWoO5v4fK4Jz6mJxq4ZKecQjQ4H0zH1Jjye";
   private final UserRepository userRepository;
   private final RefreshTokenRepository refreshTokenRepository;
   private final PasswordEncoder passwordEncoder;
   private final JwtService jwtService;
   private final SecurityProperties properties;
   private final Clock clock;
   private final AuditRecorder audit;
   private final MeterRegistry metrics;
   private final SecureRandom secureRandom = new SecureRandom();

   public AuthenticationService(UserRepository userRepository, RefreshTokenRepository refreshTokenRepository, PasswordEncoder passwordEncoder, JwtService jwtService, SecurityProperties properties, Clock clock, AuditRecorder audit, MeterRegistry metrics) {
      this.userRepository = userRepository;
      this.refreshTokenRepository = refreshTokenRepository;
      this.passwordEncoder = passwordEncoder;
      this.jwtService = jwtService;
      this.properties = properties;
      this.clock = clock;
      this.audit = audit;
      this.metrics = metrics;
   }

   public TokenResponse login(LoginRequest request) {
      User user = this.userRepository.findByEmailIgnoreCase(request.email().trim().toLowerCase(Locale.ROOT)).orElse(null);
      String encodedPassword = user == null ? "{bcrypt}$2a$10$7EqJtq98hPqEX7fNZaFWoO5v4fK4Jz6mJxq4ZKecQjQ4H0zH1Jjye" : user.getPasswordHash();
      if (this.passwordEncoder.matches(request.password(), encodedPassword) && user != null && user.getStatus() == UserStatus.ACTIVE) {
         if (this.passwordEncoder.upgradeEncoding(user.getPasswordHash())) {
            user.setPasswordHash(this.passwordEncoder.encode(request.password()));
            this.userRepository.save(user);
         }

         UUID sessionId = UUID.randomUUID();
         TokenResponse response=this.issueTokenPair(user, sessionId, UUID.randomUUID());
         this.audit.record(user.getId(),"AUTH_LOGIN","SESSION",sessionId.toString(),"SUCCESS");
         return response;
      } else {
         this.metrics.counter("lexorion.authentication.failures").increment();
         this.audit.record(user==null?null:user.getId(),"AUTH_LOGIN","USER",null,"FAILURE");
         throw new InvalidCredentialsException();
      }
   }

   @Transactional(noRollbackFor = InvalidRefreshTokenException.class)
   public TokenResponse refresh(String rawRefreshToken) {
      RefreshToken token = this.findToken(rawRefreshToken);
      Instant now = this.clock.instant();
      if (token.isRevoked()) {
         if (token.getReplacedByHash() != null) {
            this.metrics.counter("lexorion.authentication.refresh_reuse").increment();
            this.revokeFamily(token, now);
            this.audit.record(token.getUser().getId(),"REFRESH_TOKEN_REUSE","SESSION",token.getSessionId().toString(),"DENIED");
            throw new InvalidRefreshTokenException("Refresh token reuse detected; session family revoked");
         }
         throw new InvalidRefreshTokenException("Refresh token has been revoked");
      } else if (!token.getExpiresAt().isAfter(now)) {
         throw new InvalidRefreshTokenException("Refresh token has expired");
      } else if (token.getUser().getStatus() != UserStatus.ACTIVE) {
         throw new InvalidRefreshTokenException("User account is not active");
      } else {
         String nextRaw = this.newRefreshToken();
         token.setReplacedByHash(hash(nextRaw));
         this.revoke(token, now);
         TokenResponse response=this.issueTokenPair(token.getUser(), token.getSessionId(), token.getFamilyId(), nextRaw);
         this.audit.record(token.getUser().getId(),"SESSION_REFRESH","SESSION",token.getSessionId().toString(),"SUCCESS");
         return response;
      }
   }

   public void logout(String rawRefreshToken) {
      RefreshToken token = this.findToken(rawRefreshToken);
      if (!token.isRevoked()) {
         this.revoke(token, this.clock.instant());
      }
      this.audit.record(token.getUser().getId(),"SESSION_LOGOUT","SESSION",token.getSessionId().toString(),"SUCCESS");

   }

   public void revokeAll(UUID userId) {
      Instant now = this.clock.instant();
      this.refreshTokenRepository.findByUserIdAndRevokedFalse(userId).forEach(token -> this.revoke(token, now));
      this.audit.record(userId,"SESSIONS_REVOKE_ALL","USER",userId.toString(),"SUCCESS");
   }

   private TokenResponse issueTokenPair(User user, UUID sessionId, UUID familyId) {
      return issueTokenPair(user, sessionId, familyId, this.newRefreshToken());
   }

   private TokenResponse issueTokenPair(User user, UUID sessionId, UUID familyId, String rawRefreshToken) {
      JwtService.AccessToken accessToken = this.jwtService.issue(user.getId(), user.getEmail());
      RefreshToken refreshToken = new RefreshToken();
      refreshToken.setSessionId(sessionId);
      refreshToken.setFamilyId(familyId);
      refreshToken.setTokenHash(hash(rawRefreshToken));
      refreshToken.setUser(user);
      refreshToken.setExpiresAt(this.clock.instant().plus(this.properties.refreshTokenTtl()));
      refreshToken.setRevoked(false);
      this.refreshTokenRepository.save(refreshToken);
      return new TokenResponse("Bearer", accessToken.value(), accessToken.expiresAt(), rawRefreshToken, refreshToken.getExpiresAt());
   }

   private RefreshToken findToken(String rawRefreshToken) {
      return (RefreshToken)this.refreshTokenRepository.findByTokenHash(hash(rawRefreshToken)).orElseThrow(() -> new InvalidRefreshTokenException("Refresh token is invalid"));
   }

   private void revoke(RefreshToken token, Instant revokedAt) {
      token.setRevoked(true);
      token.setRevokedAt(revokedAt);
      this.refreshTokenRepository.save(token);
   }

   private void revokeFamily(RefreshToken token, Instant now) {
      this.refreshTokenRepository.findByFamilyIdAndRevokedFalse(token.getFamilyId())
            .forEach(member -> this.revoke(member, now));
   }

   private String newRefreshToken() {
      byte[] bytes = new byte[32];
      this.secureRandom.nextBytes(bytes);
      return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
   }

   private static String hash(String token) {
      try {
         return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
      } catch (NoSuchAlgorithmException ex) {
         throw new IllegalStateException("SHA-256 is unavailable", ex);
      }
   }
}
