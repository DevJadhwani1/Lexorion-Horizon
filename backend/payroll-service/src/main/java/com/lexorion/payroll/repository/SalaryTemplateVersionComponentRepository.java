package com.lexorion.payroll.repository;

import com.lexorion.payroll.domain.SalaryTemplateVersionComponent;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SalaryTemplateVersionComponentRepository extends JpaRepository<SalaryTemplateVersionComponent, UUID> {
}
