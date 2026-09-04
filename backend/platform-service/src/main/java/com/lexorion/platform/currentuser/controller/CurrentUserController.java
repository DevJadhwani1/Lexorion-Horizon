package com.lexorion.platform.currentuser.controller;

import com.lexorion.platform.currentuser.dto.CurrentUserOrganizationResponse;
import com.lexorion.platform.currentuser.dto.CurrentUserResponse;
import com.lexorion.platform.currentuser.service.CurrentUserService;
import com.lexorion.platform.security.AuthenticatedUser;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
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
}
