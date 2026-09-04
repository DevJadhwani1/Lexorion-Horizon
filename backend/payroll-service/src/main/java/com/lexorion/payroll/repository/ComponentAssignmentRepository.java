package com.lexorion.payroll.repository;
import com.lexorion.payroll.domain.ComponentAssignment;import java.util.UUID;import org.springframework.data.jpa.repository.JpaRepository;
public interface ComponentAssignmentRepository extends JpaRepository<ComponentAssignment,UUID>{}
