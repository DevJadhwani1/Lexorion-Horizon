package com.lexorion.workforce.repository;

import com.lexorion.workforce.domain.EmploymentSpell;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmploymentSpellRepository extends JpaRepository<EmploymentSpell, UUID> {
    List<EmploymentSpell> findByWorkspaceIdAndEmployeeIdOrderBySpellNumberAsc(UUID workspaceId, UUID employeeId);
    Optional<EmploymentSpell> findByEmployeeIdAndOpenEmployeeIdIsNotNull(UUID employeeId);
    Optional<EmploymentSpell> findFirstByEmployeeIdOrderBySpellNumberDesc(UUID employeeId);
    long countByEmployeeId(UUID employeeId);
}
