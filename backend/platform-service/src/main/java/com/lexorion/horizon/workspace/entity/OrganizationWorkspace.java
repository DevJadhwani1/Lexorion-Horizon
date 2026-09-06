package com.lexorion.horizon.workspace.entity;

import com.lexorion.core.config.Auditable;
import com.lexorion.core.organization.entity.Organization;
import com.lexorion.horizon.product.entity.Product;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "organization_workspaces",
        uniqueConstraints = @UniqueConstraint(name = "uk_workspace_org_key", columnNames = {"organization_id", "workspace_key"}),
        indexes = {@Index(name = "idx_workspace_organization", columnList = "organization_id"),
                @Index(name = "idx_workspace_status", columnList = "status")})
@Getter @Setter @NoArgsConstructor
public class OrganizationWorkspace extends Auditable {
    @Id @UuidGenerator @Column(nullable = false, updatable = false)
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false, updatable = false)
    private Organization organization;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false, updatable = false)
    private Product product;
    @jakarta.persistence.ManyToMany(fetch = FetchType.LAZY)
    @jakarta.persistence.JoinTable(name = "workspace_products", joinColumns = @JoinColumn(name = "workspace_id"), inverseJoinColumns = @JoinColumn(name = "product_id"))
    private java.util.Set<Product> products = new java.util.HashSet<>();
    public java.util.Set<Product> availableProducts() {
        var result = new java.util.HashSet<>(products);
        if (product != null) result.add(product);
        return result;
    }
    @Column(name = "workspace_key", nullable = false, length = 63, updatable = false)
    private String key;
    @Column(nullable = false, length = 150)
    private String displayName;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private WorkspaceStatus status = WorkspaceStatus.ACTIVE;
}
