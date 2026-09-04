package com.lexorion.platform.invitation.controller;

import com.lexorion.platform.invitation.dto.AcceptInvitationRequest;
import com.lexorion.platform.invitation.dto.InvitationAcceptanceResponse;
import com.lexorion.platform.invitation.service.OrganizationInvitationService;
import com.lexorion.platform.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/invitations"})
public class InvitationAcceptanceController {
   private final OrganizationInvitationService service;

   public InvitationAcceptanceController(OrganizationInvitationService service) {
      this.service = service;
   }

   @PostMapping({"/accept"})
   public InvitationAcceptanceResponse accept(@RequestBody @Valid AcceptInvitationRequest request, @AuthenticationPrincipal AuthenticatedUser user) {
      return this.service.accept(request.token(), user);
   }
}
