package com.lexorion.payroll.repository;

import com.lexorion.payroll.domain.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface StatutoryRuleVersionRepository extends JpaRepository<StatutoryRuleVersion, UUID> {
    @Query("select r from StatutoryRuleVersion r where r.scheme = :scheme and r.jurisdiction = :jurisdiction and r.effectiveFrom <= :date and (r.effectiveTo is null or r.effectiveTo >= :date) order by r.effectiveFrom desc")
    List<StatutoryRuleVersion> findEffective(@Param("scheme") StatutoryScheme scheme, @Param("jurisdiction") String jurisdiction, @Param("date") LocalDate date);
}
