package com.lexorion.horizon.workspace.dto;

import com.lexorion.horizon.workspace.entity.OrganizationWorkspace;
import com.lexorion.horizon.workspace.entity.WorkspaceStatus;

public record WorkspaceResponse(String key, String displayName, WorkspaceStatus status,
                                String productKey, String productName, java.util.List<ProductSummary> products) {
    public record ProductSummary(String key, String displayName) {}
    public static WorkspaceResponse from(OrganizationWorkspace workspace) {
        return new WorkspaceResponse(workspace.getKey(), workspace.getDisplayName(), workspace.getStatus(),
                workspace.getProduct().getKey(), workspace.getProduct().getDisplayName(), workspace.availableProducts().stream()
                    .sorted(java.util.Comparator.comparing(com.lexorion.horizon.product.entity.Product::getKey))
                    .map(p -> new ProductSummary(p.getKey(), p.getDisplayName())).toList());
    }
}
