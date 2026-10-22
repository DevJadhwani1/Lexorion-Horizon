package com.lexorion.finance.repository;

import com.lexorion.finance.domain.BillingClient;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BillingClientRepository extends JpaRepository<BillingClient, UUID> {
    List<BillingClient> findByWorkspaceIdOrderByDisplayNameAsc(UUID workspaceId);

    Optional<BillingClient> findByWorkspaceIdAndClientKey(UUID workspaceId, String clientKey);

    boolean existsByWorkspaceIdAndClientKey(UUID workspaceId, String clientKey);

    long countByWorkspaceIdAndStatus(UUID workspaceId, com.lexorion.finance.domain.ClientStatus status);
}
