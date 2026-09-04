package com.lexorion.platform.domain.repository;

import com.lexorion.platform.domain.entity.OrganizationDomain;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationDomainRepository extends JpaRepository<OrganizationDomain, UUID> {
   boolean existsByHostname(String hostname);

   boolean existsByOrganizationId(UUID organizationId);

   Optional<OrganizationDomain> findByHostname(String hostname);

   @Query("select domain from OrganizationDomain domain\njoin fetch domain.organization\nwhere domain.hostname = :hostname\n")
   Optional<OrganizationDomain> findByHostnameWithOrganization(@Param("hostname") String hostname);

   @Lock(LockModeType.PESSIMISTIC_WRITE)
   @Query("select domain from OrganizationDomain domain\nwhere domain.organization.id = :organizationId and domain.hostname = :hostname\n")
   Optional<OrganizationDomain> findOwnedForUpdate(@Param("organizationId") UUID organizationId, @Param("hostname") String hostname);

   List<OrganizationDomain> findByOrganizationIdOrderByPrimaryDomainDescHostnameAsc(UUID organizationId);

   @Modifying(
      clearAutomatically = true,
      flushAutomatically = true
   )
   @Query("update OrganizationDomain domain\nset domain.primaryDomain = false\nwhere domain.organization.id = :organizationId and domain.primaryDomain = true\n")
   int clearPrimaryForOrganization(@Param("organizationId") UUID organizationId);
}
