package com.lexorion.platform.auth.repository;

import com.lexorion.platform.auth.entity.RefreshToken;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
   @Lock(LockModeType.PESSIMISTIC_WRITE)
   Optional<RefreshToken> findByTokenHash(String tokenHash);
}
