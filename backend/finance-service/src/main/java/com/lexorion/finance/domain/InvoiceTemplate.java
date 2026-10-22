package com.lexorion.finance.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

/** A workspace's bill format: branding, seller details, numbering, tax presentation and industry fields. */
@Entity
@Table(name = "finance_invoice_templates", uniqueConstraints = @UniqueConstraint(name = "uk_finance_template_workspace_key", columnNames = {"workspace_id", "template_key"}))
@Getter
@Setter
@NoArgsConstructor
public class InvoiceTemplate extends Auditable {
    @Id
    @UuidGenerator
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false, updatable = false)
    private FinanceWorkspace workspace;

    @Column(name = "template_key", nullable = false, updatable = false, length = 63)
    private String templateKey;

    @Column(nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private TemplateLayout layout = TemplateLayout.MODERN;

    @Column(name = "is_default", nullable = false)
    private boolean defaultTemplate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private TemplateStatus status = TemplateStatus.ACTIVE;

    /** {@link com.lexorion.finance.api.TemplateConfig} as JSON. */
    @Column(nullable = false, columnDefinition = "text")
    private String config;
}
