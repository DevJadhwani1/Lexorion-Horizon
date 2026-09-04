package com.lexorion.platform.platformaccess.controller;

import com.lexorion.platform.platformaccess.dto.CreatePlatformAccessRequest;
import com.lexorion.platform.platformaccess.dto.PlatformAccessResponse;
import com.lexorion.platform.platformaccess.dto.UpdatePlatformAccessStatusRequest;
import com.lexorion.platform.platformaccess.dto.UpdatePlatformRoleRequest;
import com.lexorion.platform.platformaccess.service.PlatformAccessService;
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
@RequestMapping({"/api/platform/platform-access"})
@PreAuthorize("hasAuthority('PLATFORM_ACCESS')")
public class PlatformAccessController {
   private final PlatformAccessService platformAccessService;

   public PlatformAccessController(PlatformAccessService platformAccessService) {
      this.platformAccessService = platformAccessService;
   }

   @PostMapping
   public ResponseEntity<PlatformAccessResponse> grant(@RequestBody @Valid CreatePlatformAccessRequest request) {
      PlatformAccessResponse created = this.platformAccessService.grant(request);
      return ResponseEntity.created(URI.create("/api/platform/platform-access/" + String.valueOf(created.userId()))).body(created);
   }

   @GetMapping({"/{userId}"})
   public PlatformAccessResponse getByUserId(@PathVariable UUID userId) {
      return this.platformAccessService.getByUserId(userId);
   }

   @GetMapping
   public List<PlatformAccessResponse> list() {
      return this.platformAccessService.list();
   }

   @PatchMapping({"/{userId}/role"})
   public PlatformAccessResponse updateRole(@PathVariable UUID userId, @RequestBody @Valid UpdatePlatformRoleRequest request) {
      return this.platformAccessService.updateRole(userId, request);
   }

   @PatchMapping({"/{userId}/status"})
   public PlatformAccessResponse updateStatus(@PathVariable UUID userId, @RequestBody @Valid UpdatePlatformAccessStatusRequest request) {
      return this.platformAccessService.updateStatus(userId, request);
   }
}
