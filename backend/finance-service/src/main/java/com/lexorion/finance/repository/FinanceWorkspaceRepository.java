package com.lexorion.finance.repository;

import com.lexorion.finance.domain.FinanceWorkspace;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FinanceWorkspaceRepository extends JpaRepository<FinanceWorkspace, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select w from FinanceWorkspace w where w.id = :id")
    Optional<FinanceWorkspace> findByIdForUpdate(@Param("id") UUID id);
}
