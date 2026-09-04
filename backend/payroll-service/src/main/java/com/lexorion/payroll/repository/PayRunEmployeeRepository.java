package com.lexorion.payroll.repository;
import com.lexorion.payroll.domain.PayRunEmployee;import java.util.*;import org.springframework.data.jpa.repository.JpaRepository;
public interface PayRunEmployeeRepository extends JpaRepository<PayRunEmployee,UUID>{List<PayRunEmployee>findByPayRunIdOrderByEmployeeCodeAsc(UUID payRunId);boolean existsByPayRunIdAndPayrollEmployeeId(UUID payRunId,UUID employeeId);long countByPayRunId(UUID payRunId);}
