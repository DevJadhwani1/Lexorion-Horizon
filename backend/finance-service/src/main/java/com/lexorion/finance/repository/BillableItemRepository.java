package com.lexorion.finance.repository;

import com.lexorion.finance.domain.BillableItem;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BillableItemRepository extends JpaRepository<BillableItem, UUID> {
    List<BillableItem> findByWorkspaceIdOrderByItemCodeAsc(UUID workspaceId);

    Optional<BillableItem> findByWorkspaceIdAndItemCode(UUID workspaceId, String itemCode);

    boolean existsByWorkspaceIdAndItemCode(UUID workspaceId, String itemCode);
}
