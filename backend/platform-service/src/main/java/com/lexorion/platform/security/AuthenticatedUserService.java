package com.lexorion.platform.security;

import com.lexorion.platform.membership.entity.MembershipStatus;
import com.lexorion.platform.membership.repository.OrganizationMembershipRepository;
import com.lexorion.platform.platformaccess.entity.PlatformAccessStatus;
import com.lexorion.platform.platformaccess.repository.PlatformAccessRepository;
import com.lexorion.platform.user.entity.User;
import com.lexorion.platform.user.entity.UserStatus;
import com.lexorion.platform.user.repository.UserRepository;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthenticatedUserService {
   private final UserRepository userRepository;
   private final PlatformAccessRepository platformAccessRepository;
   private final OrganizationMembershipRepository membershipRepository;

   public AuthenticatedUserService(UserRepository userRepository, PlatformAccessRepository platformAccessRepository, OrganizationMembershipRepository membershipRepository) {
      this.userRepository = userRepository;
      this.platformAccessRepository = platformAccessRepository;
      this.membershipRepository = membershipRepository;
   }

   @Transactional(
      readOnly = true
   )
   public AuthenticatedUser load(UUID userId) {
      User user = (User)this.userRepository.findById(userId).orElseThrow(() -> new UsernameNotFoundException("Authenticated user no longer exists"));
      if (user.getStatus() != UserStatus.ACTIVE) {
         throw new DisabledException("User account is not active");
      } else {
         boolean platformAccess = this.platformAccessRepository.findByUserId(userId).filter((access) -> access.getStatus() == PlatformAccessStatus.ACTIVE).isPresent();
         Map<UUID, OrganizationAuthority> organizations = (Map)this.membershipRepository.findByUserIdAndStatus(userId, MembershipStatus.ACTIVE).stream().collect(Collectors.toUnmodifiableMap((m) -> m.getOrganization().getId(), (m) -> new OrganizationAuthority(m.getRole(), m.getOrganization().getStatus())));
         return new AuthenticatedUser(user.getId(), user.getEmail(), organizations, platformAccess);
      }
   }
}
