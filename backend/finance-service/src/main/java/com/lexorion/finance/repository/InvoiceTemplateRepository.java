package com.lexorion.finance.repository;

import com.lexorion.finance.domain.InvoiceTemplate;
import com.lexorion.finance.domain.TemplateStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvoiceTemplateRepository extends JpaRepository<InvoiceTemplate, UUID> {
    List<InvoiceTemplate> findByWorkspaceIdOrderByNameAsc(UUID workspaceId);

    Optional<InvoiceTemplate> findByWorkspaceIdAndTemplateKey(UUID workspaceId, String templateKey);

    Optional<InvoiceTemplate> findFirstByWorkspaceIdAndDefaultTemplateTrueAndStatus(UUID workspaceId, TemplateStatus status);

    boolean existsByWorkspaceIdAndTemplateKey(UUID workspaceId, String templateKey);
}
