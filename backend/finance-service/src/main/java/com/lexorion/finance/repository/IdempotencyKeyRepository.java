package com.lexorion.finance.repository;

import com.lexorion.finance.domain.IdempotencyKey;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IdempotencyKeyRepository extends JpaRepository<IdempotencyKey, UUID> {
    Optional<IdempotencyKey> findByWorkspaceIdAndOperationAndKey(UUID workspaceId, String operation, String key);
}
