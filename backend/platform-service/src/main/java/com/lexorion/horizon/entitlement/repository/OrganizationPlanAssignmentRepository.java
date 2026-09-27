package com.lexorion.horizon.entitlement.repository;
import com.lexorion.horizon.entitlement.entity.*;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface OrganizationPlanAssignmentRepository extends JpaRepository<OrganizationPlanAssignment, UUID> {
    @Query("select a from OrganizationPlanAssignment a join fetch a.plan where a.organization.id = :organizationId")
    Optional<OrganizationPlanAssignment> findForOrganization(@Param("organizationId") UUID organizationId);
    @Query("select a from OrganizationPlanAssignment a join fetch a.plan where a.status = com.lexorion.horizon.entitlement.entity.AssignmentStatus.ACTIVE order by a.organization.id")
    List<OrganizationPlanAssignment> findAllActive();
}
