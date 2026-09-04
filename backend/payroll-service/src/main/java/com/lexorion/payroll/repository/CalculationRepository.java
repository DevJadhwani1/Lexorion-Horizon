package com.lexorion.payroll.repository;
import com.lexorion.payroll.domain.Calculation;import java.util.*;import org.springframework.data.jpa.repository.JpaRepository;
public interface CalculationRepository extends JpaRepository<Calculation,UUID>{List<Calculation>findByWorkspaceIdAndEmployeeCodeOrderByCalculationDateAscCreatedAtAsc(UUID workspaceId,String employeeCode);}
