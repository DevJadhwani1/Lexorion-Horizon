package com.lexorion.payroll.repository;

import com.lexorion.payroll.domain.StatutoryProfile;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface StatutoryProfileRepository extends JpaRepository<StatutoryProfile, UUID> {
    Optional<StatutoryProfile> findByPayrollEmployeeId(UUID payrollEmployeeId);
    @Query("select p.payrollEmployee.employeeCode from StatutoryProfile p where p.workspace.id = :workspaceId and p.payrollEmployee.id <> :excluded and p.pan = :value")
    List<String> findCodesWithPan(@Param("workspaceId") UUID workspaceId, @Param("excluded") UUID excluded, @Param("value") String value);
    @Query("select p.payrollEmployee.employeeCode from StatutoryProfile p where p.workspace.id = :workspaceId and p.payrollEmployee.id <> :excluded and p.uan = :value")
    List<String> findCodesWithUan(@Param("workspaceId") UUID workspaceId, @Param("excluded") UUID excluded, @Param("value") String value);
    @Query("select p.payrollEmployee.employeeCode from StatutoryProfile p where p.workspace.id = :workspaceId and p.payrollEmployee.id <> :excluded and p.esiIpNumber = :value")
    List<String> findCodesWithEsiIpNumber(@Param("workspaceId") UUID workspaceId, @Param("excluded") UUID excluded, @Param("value") String value);
}
