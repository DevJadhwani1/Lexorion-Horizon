package com.lexorion.horizon.entitlement.repository;
import com.lexorion.horizon.entitlement.entity.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface OrganizationPlanAssignmentRepository extends JpaRepository<OrganizationPlanAssignment, UUID> {
    @Query("select a from OrganizationPlanAssignment a join fetch a.product join fetch a.plan where a.organization.id = :organizationId order by a.product.key")
    List<OrganizationPlanAssignment> findForOrganization(@Param("organizationId") UUID organizationId);
    @Query("select a from OrganizationPlanAssignment a join fetch a.product join fetch a.plan where a.organization.id = :organizationId and a.product.id = :productId")
    Optional<OrganizationPlanAssignment> findForOrganizationAndProduct(@Param("organizationId") UUID organizationId, @Param("productId") UUID productId);
}
