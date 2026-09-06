package com.lexorion.core.organization.repository;

import com.lexorion.core.organization.entity.Organization;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationRepository extends JpaRepository<Organization, UUID> {
   boolean existsByOrganizationCode(String organizationCode);

   boolean existsBySlug(String slug);

   Optional<Organization> findBySlug(String slug);

   List<Organization> findBySlugIsNullOrderByCreatedAtAsc();

   @Lock(LockModeType.PESSIMISTIC_WRITE)
   @Query("select organization from Organization organization where organization.id = :id")
   Optional<Organization> findByIdForUpdate(@Param("id") UUID id);
}
