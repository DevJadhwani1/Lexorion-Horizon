package com.lexorion.finance.repository;

import com.lexorion.finance.domain.NumberSequence;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NumberSequenceRepository extends JpaRepository<NumberSequence, UUID> {
    Optional<NumberSequence> findByWorkspaceIdAndScope(UUID workspaceId, String scope);
}
