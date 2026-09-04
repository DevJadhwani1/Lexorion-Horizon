package com.lexorion.platform.platformaccess.service;

import com.lexorion.platform.exception.DuplicateResourceException;
import com.lexorion.platform.exception.ResourceNotFoundException;
import com.lexorion.platform.platformaccess.dto.CreatePlatformAccessRequest;
import com.lexorion.platform.platformaccess.dto.PlatformAccessResponse;
import com.lexorion.platform.platformaccess.dto.UpdatePlatformAccessStatusRequest;
import com.lexorion.platform.platformaccess.dto.UpdatePlatformRoleRequest;
import com.lexorion.platform.platformaccess.entity.PlatformAccess;
import com.lexorion.platform.platformaccess.entity.PlatformAccessStatus;
import com.lexorion.platform.platformaccess.repository.PlatformAccessRepository;
import com.lexorion.platform.user.entity.User;
import com.lexorion.platform.user.service.UserService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PlatformAccessService {
   private final PlatformAccessRepository platformAccessRepository;
   private final UserService userService;

   public PlatformAccessService(PlatformAccessRepository platformAccessRepository, UserService userService) {
      this.platformAccessRepository = platformAccessRepository;
      this.userService = userService;
   }

   public PlatformAccessResponse grant(CreatePlatformAccessRequest request) {
      User user = this.userService.getEntity(request.userId());
      if (this.platformAccessRepository.existsByUserId(user.getId())) {
         throw new DuplicateResourceException("Platform access already granted to user " + String.valueOf(user.getId()));
      } else {
         PlatformAccess access = new PlatformAccess();
         access.setUser(user);
         access.setRole(request.role());
         access.setStatus(PlatformAccessStatus.ACTIVE);
         access.setGrantedAt(Instant.now());
         return PlatformAccessResponse.from((PlatformAccess)this.platformAccessRepository.save(access));
      }
   }

   @Transactional(
      readOnly = true
   )
   public PlatformAccessResponse getByUserId(UUID userId) {
      return PlatformAccessResponse.from(this.findOrThrow(userId));
   }

   @Transactional(
      readOnly = true
   )
   public List<PlatformAccessResponse> list() {
      return this.platformAccessRepository.findAll().stream().map(PlatformAccessResponse::from).toList();
   }

   public PlatformAccessResponse updateRole(UUID userId, UpdatePlatformRoleRequest request) {
      PlatformAccess access = this.findOrThrow(userId);
      access.setRole(request.role());
      return PlatformAccessResponse.from((PlatformAccess)this.platformAccessRepository.saveAndFlush(access));
   }

   public PlatformAccessResponse updateStatus(UUID userId, UpdatePlatformAccessStatusRequest request) {
      PlatformAccess access = this.findOrThrow(userId);
      access.setStatus(request.status());
      return PlatformAccessResponse.from((PlatformAccess)this.platformAccessRepository.saveAndFlush(access));
   }

   private PlatformAccess findOrThrow(UUID userId) {
      return (PlatformAccess)this.platformAccessRepository.findByUserId(userId).orElseThrow(() -> new ResourceNotFoundException("Platform access not found for user: " + String.valueOf(userId)));
   }
}
