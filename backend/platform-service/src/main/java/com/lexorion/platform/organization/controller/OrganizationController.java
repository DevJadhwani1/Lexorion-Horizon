package com.lexorion.platform.organization.controller;

import com.lexorion.platform.organization.dto.CreateOrganizationRequest;
import com.lexorion.platform.organization.dto.OrganizationResponse;
import com.lexorion.platform.organization.dto.UpdateOrganizationRequest;
import com.lexorion.platform.organization.dto.UpdateOrganizationStatusRequest;
import com.lexorion.platform.organization.service.OrganizationService;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/api/platform/organizations"})
public class OrganizationController {
   private final OrganizationService organizationService;

   public OrganizationController(OrganizationService organizationService) {
      this.organizationService = organizationService;
   }

   @PostMapping
   @PreAuthorize("hasAuthority('PLATFORM_ACCESS')")
   public ResponseEntity<OrganizationResponse> create(@RequestBody @Valid CreateOrganizationRequest request) {
      OrganizationResponse created = this.organizationService.create(request);
      return ResponseEntity.created(URI.create("/api/platform/organizations/" + String.valueOf(created.id()))).body(created);
   }

   @GetMapping({"/{id}"})
   @PreAuthorize("@authorization.canReadOrganization(authentication, #id)")
   public OrganizationResponse getById(@PathVariable UUID id) {
      return this.organizationService.getById(id);
   }

   @GetMapping
   @PreAuthorize("hasAuthority('PLATFORM_ACCESS')")
   public List<OrganizationResponse> list() {
      return this.organizationService.list();
   }

   @PatchMapping({"/{id}"})
   @PreAuthorize("hasAuthority('PLATFORM_ACCESS')")
   public OrganizationResponse update(@PathVariable UUID id, @RequestBody @Valid UpdateOrganizationRequest request) {
      return this.organizationService.update(id, request);
   }

   @PatchMapping({"/{id}/status"})
   @PreAuthorize("hasAuthority('PLATFORM_ACCESS')")
   public OrganizationResponse updateStatus(@PathVariable UUID id, @RequestBody @Valid UpdateOrganizationStatusRequest request) {
      return this.organizationService.updateStatus(id, request);
   }
}
