package com.lexorion.platform.auth.controller;

import com.lexorion.core.auth.dto.LoginRequest;
import com.lexorion.core.auth.dto.RefreshTokenRequest;
import com.lexorion.core.auth.dto.TokenResponse;
import com.lexorion.core.auth.service.AuthenticationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.lexorion.platform.security.AuthenticatedUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

@RestController
@RequestMapping({"/api/platform/auth", "/api/core/auth"})
public class AuthenticationController {
   private final AuthenticationService authenticationService;

   public AuthenticationController(AuthenticationService authenticationService) {
      this.authenticationService = authenticationService;
   }

   @PostMapping({"/login"})
   public TokenResponse login(@RequestBody @Valid LoginRequest request) {
      return this.authenticationService.login(request);
   }

   @PostMapping({"/refresh"})
   public TokenResponse refresh(@RequestBody @Valid RefreshTokenRequest request) {
      return this.authenticationService.refresh(request.refreshToken());
   }

   @PostMapping({"/logout"})
   public ResponseEntity<Void> logout(@RequestBody @Valid RefreshTokenRequest request) {
      this.authenticationService.logout(request.refreshToken());
      return ResponseEntity.noContent().build();
   }

   @PostMapping({"/sessions/revoke-all"})
   public ResponseEntity<Void> revokeAll(@AuthenticationPrincipal AuthenticatedUser user) {
      this.authenticationService.revokeAll(user.userId());
      return ResponseEntity.noContent().build();
   }
}
