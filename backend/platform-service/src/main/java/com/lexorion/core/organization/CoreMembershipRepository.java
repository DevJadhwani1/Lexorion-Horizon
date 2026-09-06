package com.lexorion.core.organization;

import java.util.List;
import java.util.UUID;
import org.springframework.data.repository.Repository;

public interface CoreMembershipRepository extends Repository<CoreOrganizationMembership, UUID> {
    List<CoreOrganizationMembership> findByUserIdAndStatus(UUID userId, String status);
    boolean existsByUserIdAndOrganizationIdAndStatus(UUID userId, UUID organizationId, String status);
}
