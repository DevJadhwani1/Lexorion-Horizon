package com.lexorion.horizon.workspace.repository;

import com.lexorion.horizon.workspace.entity.OrganizationWorkspace;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationWorkspaceRepository extends JpaRepository<OrganizationWorkspace, UUID> {
    boolean existsByOrganizationIdAndKey(UUID organizationId, String key);

    @Query("""
            select workspace from OrganizationWorkspace workspace join fetch workspace.product join fetch workspace.organization
            where workspace.organization.id = :organizationId order by lower(workspace.displayName), workspace.key
            """)
    List<OrganizationWorkspace> findTenantWorkspaces(@Param("organizationId") UUID organizationId);

    @Query("""
            select workspace from OrganizationWorkspace workspace join fetch workspace.product join fetch workspace.organization
            where workspace.organization.id = :organizationId and workspace.key = :key
            """)
    Optional<OrganizationWorkspace> findTenantWorkspace(@Param("organizationId") UUID organizationId,
                                                         @Param("key") String key);
}
