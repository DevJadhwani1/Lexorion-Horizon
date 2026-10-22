package com.lexorion.horizon.currentuser.controller;

import com.lexorion.horizon.currentuser.dto.CurrentUserOrganizationResponse;
import com.lexorion.horizon.currentuser.dto.CurrentUserResponse;
import com.lexorion.horizon.currentuser.dto.UpdateLastUsedContextRequest;
import com.lexorion.horizon.currentuser.service.CurrentUserService;
import com.lexorion.platform.security.AuthenticatedUser;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/platform/me"})
public class CurrentUserController {
   private final CurrentUserService currentUserService;

   public CurrentUserController(CurrentUserService currentUserService) {
      this.currentUserService = currentUserService;
   }

   @GetMapping
   public CurrentUserResponse getCurrentUser(@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
      return this.currentUserService.getCurrentUser(authenticatedUser.userId());
   }

   @GetMapping({"/organizations"})
   public List<CurrentUserOrganizationResponse> getOrganizations(@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
      return this.currentUserService.getOrganizations(authenticatedUser.userId());
   }

   @PutMapping({"/context"})
   public ResponseEntity<Void> updateLastUsedContext(@AuthenticationPrincipal AuthenticatedUser authenticatedUser, @RequestBody @Valid UpdateLastUsedContextRequest request) {
      this.currentUserService.updateLastUsedContext(authenticatedUser.userId(), request);
      return ResponseEntity.noContent().build();
   }
}
