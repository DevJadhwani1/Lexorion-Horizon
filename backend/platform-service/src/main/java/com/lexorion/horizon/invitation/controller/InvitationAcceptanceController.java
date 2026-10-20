package com.lexorion.horizon.invitation.controller;

import com.lexorion.horizon.invitation.dto.AcceptInvitationRequest;
import com.lexorion.horizon.invitation.dto.InvitationAcceptanceResponse;
import com.lexorion.horizon.invitation.service.OrganizationInvitationService;
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
   private final com.lexorion.horizon.invitation.service.InvitationRegistrationService registration;

   public InvitationAcceptanceController(OrganizationInvitationService service, com.lexorion.horizon.invitation.service.InvitationRegistrationService registration) {
      this.service = service;
      this.registration = registration;
   }

   @PostMapping("/preview")
   public OrganizationInvitationService.InvitationPreview preview(@RequestBody @Valid AcceptInvitationRequest request) {
      return service.preview(request.token());
   }

   public record RegistrationRequest(@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=200) String token,
         @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=100) String firstName,
         @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=100) String lastName,
         @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(min=12, max=72) String password) {}

   @PostMapping("/register")
   public InvitationAcceptanceResponse register(@RequestBody @Valid RegistrationRequest request) {
      return registration.register(request.token(), request.firstName(), request.lastName(), request.password());
   }

   @PostMapping({"/accept"})
   public InvitationAcceptanceResponse accept(@RequestBody @Valid AcceptInvitationRequest request, @AuthenticationPrincipal AuthenticatedUser user) {
      return this.service.accept(request.token(), user);
   }
}
