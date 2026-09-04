package com.lexorion.platform.auth.service;

import com.lexorion.platform.auth.dto.LoginRequest;
import com.lexorion.platform.auth.dto.TokenResponse;
import com.lexorion.platform.auth.entity.RefreshToken;
import com.lexorion.platform.auth.exception.InvalidCredentialsException;
import com.lexorion.platform.auth.exception.InvalidRefreshTokenException;
import com.lexorion.platform.auth.repository.RefreshTokenRepository;
import com.lexorion.platform.security.JwtService;
import com.lexorion.platform.security.SecurityProperties;
import com.lexorion.platform.user.entity.User;
import com.lexorion.platform.user.entity.UserStatus;
import com.lexorion.platform.user.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
   private final SecureRandom secureRandom = new SecureRandom();

   public AuthenticationService(UserRepository userRepository, RefreshTokenRepository refreshTokenRepository, PasswordEncoder passwordEncoder, JwtService jwtService, SecurityProperties properties, Clock clock) {
      this.userRepository = userRepository;
      this.refreshTokenRepository = refreshTokenRepository;
      this.passwordEncoder = passwordEncoder;
      this.jwtService = jwtService;
      this.properties = properties;
      this.clock = clock;
   }

   public TokenResponse login(LoginRequest request) {
      User user = this.userRepository.findByEmailIgnoreCase(request.email().trim().toLowerCase(Locale.ROOT)).orElse(null);
      String encodedPassword = user == null ? "{bcrypt}$2a$10$7EqJtq98hPqEX7fNZaFWoO5v4fK4Jz6mJxq4ZKecQjQ4H0zH1Jjye" : user.getPasswordHash();
      if (this.passwordEncoder.matches(request.password(), encodedPassword) && user != null && user.getStatus() == UserStatus.ACTIVE) {
         if (this.passwordEncoder.upgradeEncoding(user.getPasswordHash())) {
            user.setPasswordHash(this.passwordEncoder.encode(request.password()));
            this.userRepository.save(user);
         }

         return this.issueTokenPair(user);
      } else {
         throw new InvalidCredentialsException();
      }
   }

   public TokenResponse refresh(String rawRefreshToken) {
      RefreshToken token = this.findToken(rawRefreshToken);
      Instant now = this.clock.instant();
      if (token.isRevoked()) {
         throw new InvalidRefreshTokenException("Refresh token has been revoked");
      } else if (!token.getExpiresAt().isAfter(now)) {
         throw new InvalidRefreshTokenException("Refresh token has expired");
      } else if (token.getUser().getStatus() != UserStatus.ACTIVE) {
         throw new InvalidRefreshTokenException("User account is not active");
      } else {
         this.revoke(token, now);
         return this.issueTokenPair(token.getUser());
      }
   }

   public void logout(String rawRefreshToken) {
      RefreshToken token = this.findToken(rawRefreshToken);
      if (!token.isRevoked()) {
         this.revoke(token, this.clock.instant());
      }

   }

   private TokenResponse issueTokenPair(User user) {
      JwtService.AccessToken accessToken = this.jwtService.issue(user.getId(), user.getEmail());
      String rawRefreshToken = this.newRefreshToken();
      RefreshToken refreshToken = new RefreshToken();
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
