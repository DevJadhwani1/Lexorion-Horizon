package com.lexorion.platform.currentuser.service;

import com.lexorion.platform.currentuser.dto.CurrentPlatformAccessResponse;
import com.lexorion.platform.currentuser.dto.CurrentUserOrganizationResponse;
import com.lexorion.platform.currentuser.dto.CurrentUserResponse;
import com.lexorion.platform.exception.ResourceNotFoundException;
import com.lexorion.platform.membership.entity.MembershipStatus;
import com.lexorion.platform.membership.repository.OrganizationMembershipRepository;
import com.lexorion.platform.organization.entity.Organization;
import com.lexorion.platform.platformaccess.entity.PlatformAccess;
import com.lexorion.platform.platformaccess.entity.PlatformAccessStatus;
import com.lexorion.platform.platformaccess.entity.PlatformRole;
import com.lexorion.platform.platformaccess.repository.PlatformAccessRepository;
import com.lexorion.platform.user.entity.User;
import com.lexorion.platform.user.entity.UserStatus;
import com.lexorion.platform.user.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CurrentUserService {
   private final UserRepository userRepository;
   private final PlatformAccessRepository platformAccessRepository;
   private final OrganizationMembershipRepository membershipRepository;

   public CurrentUserService(UserRepository userRepository, PlatformAccessRepository platformAccessRepository, OrganizationMembershipRepository membershipRepository) {
      this.userRepository = userRepository;
      this.platformAccessRepository = platformAccessRepository;
      this.membershipRepository = membershipRepository;
   }

   @Transactional(
      readOnly = true
   )
   public CurrentUserResponse getCurrentUser(UUID authenticatedUserId) {
      User user = (User)this.userRepository.findById(authenticatedUserId).orElseThrow(() -> ResourceNotFoundException.of("User", authenticatedUserId));
      Optional<PlatformAccess> activeAccess = this.platformAccessRepository.findByUserId(authenticatedUserId).filter((access) -> access.getStatus() == PlatformAccessStatus.ACTIVE);
      CurrentPlatformAccessResponse platformAccess = (CurrentPlatformAccessResponse)activeAccess.map((access) -> new CurrentPlatformAccessResponse(true, access.getRole())).orElseGet(() -> new CurrentPlatformAccessResponse(false, (PlatformRole)null));
      return new CurrentUserResponse(user.getId(), user.getEmail(), user.getFirstName(), user.getLastName(), user.getStatus() == UserStatus.ACTIVE, platformAccess);
   }

   @Transactional(
      readOnly = true
   )
   public List<CurrentUserOrganizationResponse> getOrganizations(UUID authenticatedUserId) {
      return this.membershipRepository.findForUserByStatusOrdered(authenticatedUserId, MembershipStatus.ACTIVE).stream().map((membership) -> {
         Organization organization = membership.getOrganization();
         return new CurrentUserOrganizationResponse(organization.getId(), organization.getName(), organization.getSlug(), membership.getRole(), membership.getStatus(), organization.getStatus());
      }).toList();
   }
}
