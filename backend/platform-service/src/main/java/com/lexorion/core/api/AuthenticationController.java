package com.lexorion.core.api;

import com.lexorion.core.auth.dto.LoginRequest;
import com.lexorion.core.auth.dto.RefreshTokenRequest;
import com.lexorion.core.auth.dto.TokenResponse;
import com.lexorion.core.auth.service.AuthenticationService;
import com.lexorion.core.auth.exception.InvalidRefreshTokenException;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.security.Principal;
import java.util.UUID;


@RestController
@RequestMapping({"/api/platform/auth", "/api/core/auth"})
public class AuthenticationController {
   private final AuthenticationService authenticationService;

   public AuthenticationController(AuthenticationService authenticationService) {
      this.authenticationService = authenticationService;
   }

   @PostMapping({"/login"})
   public ResponseEntity<TokenResponse> login(@RequestBody @Valid LoginRequest request, jakarta.servlet.http.HttpServletRequest httpRequest) {
      TokenResponse tokens = this.authenticationService.login(request);
      ResponseEntity.BodyBuilder response = ResponseEntity.ok();
      if (sharedHorizonHost(httpRequest)) response.header(HttpHeaders.SET_COOKIE, refreshCookie(tokens.refreshToken(), tokens.refreshTokenExpiresAt(), httpRequest).toString());
      return response.body(sharedHorizonHost(httpRequest) ? withoutRefreshToken(tokens) : tokens);
   }

   @PostMapping({"/refresh"})
   public ResponseEntity<TokenResponse> refresh(@RequestBody(required = false) RefreshTokenRequest request, jakarta.servlet.http.HttpServletRequest httpRequest) {
      String refreshToken = request != null && request.refreshToken() != null ? request.refreshToken() : cookie(httpRequest, "lexorion_refresh");
      if (refreshToken == null || refreshToken.isBlank()) throw new InvalidRefreshTokenException("Refresh token is invalid");
      TokenResponse tokens = this.authenticationService.refresh(refreshToken);
      ResponseEntity.BodyBuilder response = ResponseEntity.ok();
      if (sharedHorizonHost(httpRequest)) response.header(HttpHeaders.SET_COOKIE, refreshCookie(tokens.refreshToken(), tokens.refreshTokenExpiresAt(), httpRequest).toString());
      return response.body(sharedHorizonHost(httpRequest) ? withoutRefreshToken(tokens) : tokens);
   }

   @PostMapping({"/logout"})
   public ResponseEntity<Void> logout(@RequestBody(required = false) RefreshTokenRequest request, jakarta.servlet.http.HttpServletRequest httpRequest) {
      String refreshToken = request != null && request.refreshToken() != null ? request.refreshToken() : cookie(httpRequest, "lexorion_refresh");
      if (refreshToken != null && !refreshToken.isBlank()) this.authenticationService.logout(refreshToken);
      ResponseEntity.HeadersBuilder<?> response = ResponseEntity.noContent();
      if (sharedHorizonHost(httpRequest)) response.header(HttpHeaders.SET_COOKIE, clearRefreshCookie(httpRequest).toString());
      return response.build();
   }

   @PostMapping({"/sessions/revoke-all"})
   public ResponseEntity<Void> revokeAll(Principal user) {
      this.authenticationService.revokeAll(UUID.fromString(user.getName()));
      return ResponseEntity.noContent().build();
   }

   private ResponseCookie refreshCookie(String value, java.time.Instant expiresAt, jakarta.servlet.http.HttpServletRequest request) {
      ResponseCookie.ResponseCookieBuilder cookie = ResponseCookie.from("lexorion_refresh", value).httpOnly(true).secure(isProduction(request))
            .sameSite("Lax").path("/").maxAge(java.time.Duration.between(java.time.Instant.now(), expiresAt).isNegative()
                  ? java.time.Duration.ZERO : java.time.Duration.between(java.time.Instant.now(), expiresAt));
      if (sharedHorizonHost(request)) cookie.domain(".horizon.lexorion.in");
      return cookie.build();
   }
   private TokenResponse withoutRefreshToken(TokenResponse tokens) {
      return new TokenResponse(tokens.tokenType(), tokens.accessToken(), tokens.accessTokenExpiresAt(), null, tokens.refreshTokenExpiresAt());
   }
   private ResponseCookie clearRefreshCookie(jakarta.servlet.http.HttpServletRequest request) {
      ResponseCookie.ResponseCookieBuilder cookie = ResponseCookie.from("lexorion_refresh", "").httpOnly(true).secure(isProduction(request))
            .sameSite("Lax").path("/").maxAge(0);
      if (sharedHorizonHost(request)) cookie.domain(".horizon.lexorion.in");
      return cookie.build();
   }
   private boolean sharedHorizonHost(jakarta.servlet.http.HttpServletRequest request) {
      String host = request.getServerName().toLowerCase(java.util.Locale.ROOT);
      return host.equals("horizon.lexorion.in") || host.equals("admin.horizon.lexorion.in");
   }
   private boolean isProduction(jakarta.servlet.http.HttpServletRequest request) {
      return request.isSecure() || sharedHorizonHost(request);
   }
   private String cookie(jakarta.servlet.http.HttpServletRequest request, String name) {
      jakarta.servlet.http.Cookie[] cookies = request.getCookies();
      if (cookies == null) return null;
      for (jakarta.servlet.http.Cookie cookie : cookies) if (cookie.getName().equals(name)) return cookie.getValue();
      return null;
   }
}
