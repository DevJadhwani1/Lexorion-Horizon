package com.lexorion.core.user.repository;

import com.lexorion.core.user.entity.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {
   boolean existsByEmailIgnoreCase(String email);

   Optional<User> findByEmailIgnoreCase(String email);
}
