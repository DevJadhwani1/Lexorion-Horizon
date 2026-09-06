package com.lexorion.horizon.entitlement.repository;
import com.lexorion.horizon.entitlement.entity.*;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface EntitlementDefinitionRepository extends JpaRepository<EntitlementDefinition, UUID> {
    Optional<EntitlementDefinition> findByKey(String key);
    List<EntitlementDefinition> findByStatusOrderByKeyAsc(CatalogStatus status);
}
