package com.lexorion.core.security;

import com.lexorion.core.organization.CoreMembershipRepository;
import com.lexorion.core.platformaccess.entity.PlatformAccessStatus;
import com.lexorion.core.platformaccess.repository.PlatformAccessRepository;
import com.lexorion.core.user.entity.UserStatus;
import com.lexorion.core.user.repository.UserRepository;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CoreIdentityService {
    private final UserRepository users;
    private final PlatformAccessRepository operators;
    private final CoreMembershipRepository memberships;
    public CoreIdentityService(UserRepository users, PlatformAccessRepository operators, CoreMembershipRepository memberships) {
        this.users = users; this.operators = operators; this.memberships = memberships;
    }
    @Transactional(readOnly = true)
    public Identity load(UUID userId) {
        var user = users.findById(userId).orElseThrow(() -> new UsernameNotFoundException("Authenticated user no longer exists"));
        if (user.getStatus() != UserStatus.ACTIVE) throw new DisabledException("User account is not active");
        boolean operator = operators.findByUserId(userId).filter(a -> a.getStatus() == PlatformAccessStatus.ACTIVE).isPresent();
        var organizations = memberships.findByUserIdAndStatus(userId, "ACTIVE").stream()
                .map(m -> m.getOrganizationId()).collect(Collectors.toUnmodifiableSet());
        return new Identity(userId, user.getEmail(), organizations, operator);
    }
    public record Identity(UUID userId, String email, Set<UUID> organizationIds, boolean coreOperator) {}
}
