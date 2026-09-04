package com.lexorion.platform.entitlement.repository;
import com.lexorion.platform.entitlement.entity.Plan;
import com.lexorion.platform.entitlement.entity.CatalogStatus;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface PlanRepository extends JpaRepository<Plan, UUID> {
    Optional<Plan> findByKey(String key);
    List<Plan> findByStatusOrderByDisplayNameAsc(CatalogStatus status);
}
