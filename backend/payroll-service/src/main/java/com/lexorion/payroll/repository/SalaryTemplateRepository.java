package com.lexorion.payroll.repository;
import com.lexorion.payroll.domain.SalaryTemplate;import java.util.*;import org.springframework.data.jpa.repository.JpaRepository;
public interface SalaryTemplateRepository extends JpaRepository<SalaryTemplate,UUID>{List<SalaryTemplate>findByWorkspaceIdOrderByTemplateKeyAsc(UUID workspaceId);Optional<SalaryTemplate>findByWorkspaceIdAndTemplateKey(UUID workspaceId,String templateKey);boolean existsByWorkspaceIdAndTemplateKey(UUID workspaceId,String templateKey);}
