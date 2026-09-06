package com.lexorion.platform.security;

import com.lexorion.horizon.membership.entity.MembershipStatus;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import com.lexorion.core.platformaccess.entity.PlatformAccessStatus;
import com.lexorion.core.platformaccess.repository.PlatformAccessRepository;
import com.lexorion.core.user.entity.User;
import com.lexorion.core.user.entity.UserStatus;
import com.lexorion.core.user.repository.UserRepository;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthenticatedUserService {
   private final com.lexorion.core.security.CoreIdentityService identities;
   private final OrganizationMembershipRepository membershipRepository;
   public AuthenticatedUserService(com.lexorion.core.security.CoreIdentityService identities, OrganizationMembershipRepository membershipRepository) {
      this.identities = identities;
      this.membershipRepository = membershipRepository;
   }

   @Transactional(
      readOnly = true
   )
   public AuthenticatedUser load(UUID userId) {
      var identity = identities.load(userId);
      Map<UUID, OrganizationAuthority> organizations = membershipRepository.findByUserIdAndStatus(userId, MembershipStatus.ACTIVE)
            .stream().collect(Collectors.toUnmodifiableMap(m -> m.getOrganization().getId(),
                  m -> new OrganizationAuthority(m.getRole(), m.getOrganization().getStatus())));
      return new AuthenticatedUser(identity.userId(), identity.email(), organizations, identity.coreOperator());
   }
}
