package com.lexorion.payroll.repository;

import com.lexorion.payroll.domain.SalaryTemplateVersion;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SalaryTemplateVersionRepository extends JpaRepository<SalaryTemplateVersion, UUID> {
    List<SalaryTemplateVersion> findByTemplateIdOrderByVersionNumberDesc(UUID templateId);
    Optional<SalaryTemplateVersion> findByTemplateIdAndVersionNumber(UUID templateId, int versionNumber);
    boolean existsByTemplateIdAndVersionNumber(UUID templateId, int versionNumber);
    Optional<SalaryTemplateVersion> findFirstByTemplateIdOrderByVersionNumberDesc(UUID templateId);
}
