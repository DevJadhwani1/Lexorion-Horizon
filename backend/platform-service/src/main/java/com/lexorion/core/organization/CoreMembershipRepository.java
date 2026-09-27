package com.lexorion.core.organization;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoreMembershipRepository extends JpaRepository<CoreOrganizationMembership, UUID> {
    java.util.Optional<CoreOrganizationMembership> findByUserIdAndOrganizationId(UUID userId, UUID organizationId);
    List<CoreOrganizationMembership> findByOrganizationId(UUID organizationId);
    List<CoreOrganizationMembership> findByUserIdAndStatus(UUID userId, String status);
    boolean existsByUserIdAndOrganizationIdAndStatus(UUID userId, UUID organizationId, String status);
}
