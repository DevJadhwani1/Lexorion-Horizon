package com.lexorion.core.auth.repository;

import com.lexorion.core.auth.entity.RefreshToken;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import java.util.List;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
   @Lock(LockModeType.PESSIMISTIC_WRITE)
   Optional<RefreshToken> findByTokenHash(String tokenHash);
   List<RefreshToken> findByFamilyIdAndRevokedFalse(UUID familyId);
   List<RefreshToken> findByUserIdAndRevokedFalse(UUID userId);
}
