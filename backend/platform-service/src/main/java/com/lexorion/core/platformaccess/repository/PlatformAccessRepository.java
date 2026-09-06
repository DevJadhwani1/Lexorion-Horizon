package com.lexorion.core.platformaccess.repository;

import com.lexorion.core.platformaccess.entity.PlatformAccess;
import com.lexorion.core.platformaccess.entity.PlatformRole;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlatformAccessRepository extends JpaRepository<PlatformAccess, UUID> {
   boolean existsByUserId(UUID userId);

   boolean existsByRole(PlatformRole role);

   Optional<PlatformAccess> findByUserId(UUID userId);
}
