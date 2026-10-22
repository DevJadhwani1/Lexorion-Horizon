package com.lexorion.horizon.currentuser.service;

import com.lexorion.horizon.currentuser.dto.CurrentPlatformAccessResponse;
import com.lexorion.horizon.currentuser.dto.CurrentUserOrganizationResponse;
import com.lexorion.horizon.currentuser.dto.CurrentUserResponse;
import com.lexorion.horizon.currentuser.dto.UpdateLastUsedContextRequest;
import com.lexorion.core.exception.ResourceNotFoundException;
import com.lexorion.horizon.membership.entity.MembershipStatus;
import com.lexorion.horizon.membership.entity.OrganizationMembership;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import com.lexorion.horizon.workspace.repository.OrganizationWorkspaceRepository;
import com.lexorion.core.organization.entity.Organization;
import com.lexorion.core.organization.entity.OrganizationStatus;
import com.lexorion.core.platformaccess.entity.PlatformAccess;
import com.lexorion.core.platformaccess.entity.PlatformAccessStatus;
import com.lexorion.core.platformaccess.entity.PlatformRole;
import com.lexorion.core.platformaccess.repository.PlatformAccessRepository;
import com.lexorion.core.user.entity.User;
import com.lexorion.core.user.entity.UserStatus;
import com.lexorion.core.user.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CurrentUserService {
   private final UserRepository userRepository;
   private final PlatformAccessRepository platformAccessRepository;
   private final OrganizationMembershipRepository membershipRepository;
   private final OrganizationWorkspaceRepository workspaceRepository;

   public CurrentUserService(UserRepository userRepository, PlatformAccessRepository platformAccessRepository, OrganizationMembershipRepository membershipRepository, OrganizationWorkspaceRepository workspaceRepository) {
      this.userRepository = userRepository;
      this.platformAccessRepository = platformAccessRepository;
      this.membershipRepository = membershipRepository;
      this.workspaceRepository = workspaceRepository;
   }

   @Transactional(
      readOnly = true
   )
   public CurrentUserResponse getCurrentUser(UUID authenticatedUserId) {
      User user = (User)this.userRepository.findById(authenticatedUserId).orElseThrow(() -> ResourceNotFoundException.of("User", authenticatedUserId));
      Optional<PlatformAccess> activeAccess = this.platformAccessRepository.findByUserId(authenticatedUserId).filter((access) -> access.getStatus() == PlatformAccessStatus.ACTIVE);
      CurrentPlatformAccessResponse platformAccess = (CurrentPlatformAccessResponse)activeAccess.map((access) -> new CurrentPlatformAccessResponse(true, access.getRole())).orElseGet(() -> new CurrentPlatformAccessResponse(false, (PlatformRole)null));
      // Only report a last-used organization the user can still enter; the client re-verifies before restoring it.
      String lastOrganizationSlug = Optional.ofNullable(user.getLastOrganizationId())
         .flatMap((organizationId) -> this.membershipRepository.findByUserIdAndOrganizationIdAndStatus(authenticatedUserId, organizationId, MembershipStatus.ACTIVE))
         .filter(CurrentUserService::isEnterable)
         .map((membership) -> membership.getOrganization().getSlug())
         .orElse(null);
      return new CurrentUserResponse(user.getId(), user.getEmail(), user.getFirstName(), user.getLastName(), user.getStatus() == UserStatus.ACTIVE, platformAccess, lastOrganizationSlug);
   }

   @Transactional(
      readOnly = true
   )
   public List<CurrentUserOrganizationResponse> getOrganizations(UUID authenticatedUserId) {
      return this.membershipRepository.findForUserByStatusOrdered(authenticatedUserId, MembershipStatus.ACTIVE).stream().filter(membership -> membership.getRole() != null).map((membership) -> {
         Organization organization = membership.getOrganization();
         return new CurrentUserOrganizationResponse(organization.getId(), organization.getName(), organization.getSlug(), membership.getRole(), membership.getStatus(), organization.getStatus(), membership.getLastWorkspaceKey());
      }).toList();
   }

   @Transactional
   public void updateLastUsedContext(UUID authenticatedUserId, UpdateLastUsedContextRequest request) {
      User user = (User)this.userRepository.findById(authenticatedUserId).orElseThrow(() -> ResourceNotFoundException.of("User", authenticatedUserId));
      OrganizationMembership membership = this.membershipRepository.findForUserByStatusOrdered(authenticatedUserId, MembershipStatus.ACTIVE).stream()
         .filter((candidate) -> candidate.getOrganization().getSlug().equals(request.organizationSlug()))
         .filter(CurrentUserService::isEnterable)
         .findFirst()
         .orElseThrow(() -> new AccessDeniedException("Organization is not accessible"));
      user.setLastOrganizationId(membership.getOrganization().getId());
      if (request.workspaceKey() != null) {
         // Existence is checked here; product and entitlement access are re-verified when the workspace is restored.
         if (this.workspaceRepository.findTenantWorkspace(membership.getOrganization().getId(), request.workspaceKey()).isEmpty()) {
            throw new AccessDeniedException("Workspace is not accessible");
         }
         membership.setLastWorkspaceKey(request.workspaceKey());
      }
   }

   private static boolean isEnterable(OrganizationMembership membership) {
      return membership.getRole() != null && membership.getOrganization().getStatus().allowsTenantAccess();
   }
}
