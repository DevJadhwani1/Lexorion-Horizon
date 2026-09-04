package com.lexorion.payroll.repository;
import com.lexorion.payroll.domain.ComponentDefinition;import java.util.*;import org.springframework.data.jpa.repository.JpaRepository;
public interface ComponentDefinitionRepository extends JpaRepository<ComponentDefinition,UUID>{List<ComponentDefinition>findByWorkspaceIdOrderByComponentKeyAsc(UUID workspaceId);Optional<ComponentDefinition>findByWorkspaceIdAndComponentKey(UUID workspaceId,String key);boolean existsByWorkspaceIdAndComponentKey(UUID workspaceId,String key);}
