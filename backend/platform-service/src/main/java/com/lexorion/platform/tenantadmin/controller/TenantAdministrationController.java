package com.lexorion.platform.tenantadmin.controller;

import com.lexorion.platform.organizationsettings.dto.UpdateOrganizationProfileRequest;
import com.lexorion.platform.organizationsettings.dto.UpdateOrganizationSettingsRequest;
import com.lexorion.platform.tenantadmin.dto.ChangeTenantMemberRoleRequest;
import com.lexorion.platform.tenantadmin.dto.CurrentOrganizationResponse;
import com.lexorion.platform.tenantadmin.dto.TenantMemberResponse;
import com.lexorion.platform.tenantadmin.service.TenantAdministrationService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/tenant/organization"})
@PreAuthorize("@tenantAuthorization.hasAnyRole(T(com.lexorion.platform.membership.entity.OrganizationRole).OWNER, T(com.lexorion.platform.membership.entity.OrganizationRole).ADMIN)")
public class TenantAdministrationController {
   private final TenantAdministrationService service;

   public TenantAdministrationController(TenantAdministrationService service) {
      this.service = service;
   }

   @GetMapping
   public CurrentOrganizationResponse currentOrganization() {
      return this.service.currentOrganization();
   }

   @PatchMapping
   public CurrentOrganizationResponse updateProfile(@RequestBody @Valid UpdateOrganizationProfileRequest request) {
      return this.service.updateProfile(request);
   }

   @PatchMapping({"/settings"})
   public CurrentOrganizationResponse updateSettings(@RequestBody @Valid UpdateOrganizationSettingsRequest request) {
      return this.service.updateSettings(request);
   }

   @GetMapping({"/members"})
   public List<TenantMemberResponse> listMembers() {
      return this.service.listMembers();
   }

   @PatchMapping({"/members/{membershipId}/role"})
   public TenantMemberResponse changeRole(@PathVariable UUID membershipId, @RequestBody @Valid ChangeTenantMemberRoleRequest request) {
      return this.service.changeRole(membershipId, request.role());
   }

   @DeleteMapping({"/members/{membershipId}"})
   public ResponseEntity<Void> removeMember(@PathVariable UUID membershipId) {
      this.service.removeMember(membershipId);
      return ResponseEntity.noContent().build();
   }
}
