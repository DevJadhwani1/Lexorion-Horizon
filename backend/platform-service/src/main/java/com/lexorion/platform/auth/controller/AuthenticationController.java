package com.lexorion.platform.auth.controller;

import com.lexorion.platform.auth.dto.LoginRequest;
import com.lexorion.platform.auth.dto.RefreshTokenRequest;
import com.lexorion.platform.auth.dto.TokenResponse;
import com.lexorion.platform.auth.service.AuthenticationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/platform/auth"})
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
}
