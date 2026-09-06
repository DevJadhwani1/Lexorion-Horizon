package com.lexorion.horizon.entitlement.repository;
import com.lexorion.horizon.entitlement.entity.PlanEntitlement;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
public interface PlanEntitlementRepository extends JpaRepository<PlanEntitlement, UUID> {
    @Query("select pe from PlanEntitlement pe join fetch pe.definition where pe.plan.id = :planId order by pe.definition.key")
    List<PlanEntitlement> findForPlan(@Param("planId") UUID planId);
    boolean existsByPlanIdAndDefinitionId(UUID planId, UUID definitionId);
}
