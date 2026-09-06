package com.lexorion.horizon.membership.controller;

import com.lexorion.horizon.membership.dto.CreateMembershipRequest;
import com.lexorion.horizon.membership.dto.MembershipResponse;
import com.lexorion.horizon.membership.dto.UpdateMembershipRoleRequest;
import com.lexorion.horizon.membership.dto.UpdateMembershipStatusRequest;
import com.lexorion.horizon.membership.service.MembershipService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MembershipController {
   private final MembershipService membershipService;

   public MembershipController(MembershipService membershipService) {
      this.membershipService = membershipService;
   }

   @PostMapping({"/api/platform/organizations/{organizationId}/members"})
   @PreAuthorize("@authorization.canManageOrganization(authentication, #organizationId)")
   public ResponseEntity<MembershipResponse> addMember(@PathVariable UUID organizationId, @RequestBody @Valid CreateMembershipRequest request) {
      MembershipResponse created = this.membershipService.addMember(organizationId, request);
      return ResponseEntity.created(URI.create("/api/platform/memberships/" + String.valueOf(created.id()))).body(created);
   }

   @GetMapping({"/api/platform/organizations/{organizationId}/members"})
   @PreAuthorize("@authorization.canReadOrganization(authentication, #organizationId)")
   public List<MembershipResponse> listOrganizationMembers(@PathVariable UUID organizationId) {
      return this.membershipService.listByOrganization(organizationId);
   }

   @GetMapping({"/api/platform/users/{userId}/memberships"})
   @PreAuthorize("@authorization.isSelfOrPlatform(authentication, #userId)")
   public List<MembershipResponse> listUserMemberships(@PathVariable UUID userId) {
      return this.membershipService.listByUser(userId);
   }

   @PatchMapping({"/api/platform/memberships/{membershipId}/role"})
   @PreAuthorize("@authorization.canManageMembership(authentication, #membershipId)")
   public MembershipResponse updateRole(@PathVariable UUID membershipId, @RequestBody @Valid UpdateMembershipRoleRequest request) {
      return this.membershipService.updateRole(membershipId, request);
   }

   @PatchMapping({"/api/platform/memberships/{membershipId}/status"})
   @PreAuthorize("@authorization.canManageMembership(authentication, #membershipId)")
   public MembershipResponse updateStatus(@PathVariable UUID membershipId, @RequestBody @Valid UpdateMembershipStatusRequest request) {
      return this.membershipService.updateStatus(membershipId, request);
   }
}
