package com.lexorion.platform.platformaccess.repository;

import com.lexorion.platform.platformaccess.entity.PlatformAccess;
import com.lexorion.platform.platformaccess.entity.PlatformRole;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlatformAccessRepository extends JpaRepository<PlatformAccess, UUID> {
   boolean existsByUserId(UUID userId);

   boolean existsByRole(PlatformRole role);

   Optional<PlatformAccess> findByUserId(UUID userId);
}
