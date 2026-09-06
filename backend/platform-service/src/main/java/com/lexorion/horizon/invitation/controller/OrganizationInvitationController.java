package com.lexorion.horizon.invitation.controller;

import com.lexorion.horizon.invitation.dto.CreateInvitationRequest;
import com.lexorion.horizon.invitation.dto.InvitationResponse;
import com.lexorion.horizon.invitation.service.OrganizationInvitationService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/tenant/invitations"})
@PreAuthorize("@tenantAuthorization.hasAnyRole(T(com.lexorion.horizon.membership.entity.OrganizationRole).ADMIN)")
public class OrganizationInvitationController {
   private final OrganizationInvitationService service;

   public OrganizationInvitationController(OrganizationInvitationService service) {
      this.service = service;
   }

   @PostMapping
   public ResponseEntity<InvitationResponse> create(@RequestBody @Valid CreateInvitationRequest request) {
      InvitationResponse response = this.service.create(request.email(), request.role());
      return ResponseEntity.created(URI.create("/api/tenant/invitations/" + String.valueOf(response.invitationId()))).body(response);
   }

   @GetMapping
   public List<InvitationResponse> list() {
      return this.service.list();
   }

   @DeleteMapping({"/{invitationId}"})
   public ResponseEntity<Void> revoke(@PathVariable UUID invitationId) {
      this.service.revoke(invitationId);
      return ResponseEntity.noContent().build();
   }
}
