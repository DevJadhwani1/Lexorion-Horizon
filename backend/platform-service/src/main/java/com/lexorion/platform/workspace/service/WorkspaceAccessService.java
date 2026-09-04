package com.lexorion.platform.workspace.service;

import com.lexorion.platform.product.entity.ProductStatus;
import com.lexorion.platform.entitlement.service.EntitlementService;
import com.lexorion.platform.tenantaccess.context.TenantAccessContext;
import com.lexorion.platform.tenantaccess.context.TenantAccessContextHolder;
import com.lexorion.platform.workspace.dto.WorkspaceResponse;
import com.lexorion.platform.workspace.entity.OrganizationWorkspace;
import com.lexorion.platform.workspace.entity.WorkspaceStatus;
import com.lexorion.platform.workspace.repository.OrganizationWorkspaceRepository;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Runtime access seam; Stage 8 can add entitlement evaluation here without changing workspace ownership. */
@Service
public class WorkspaceAccessService {
    private final TenantAccessContextHolder contextHolder;
    private final OrganizationWorkspaceRepository repository;
    private final EntitlementService entitlementService;
    public WorkspaceAccessService(TenantAccessContextHolder contextHolder, OrganizationWorkspaceRepository repository,
                                  EntitlementService entitlementService) {
        this.contextHolder = contextHolder; this.repository = repository; this.entitlementService = entitlementService;
    }

    @Transactional(readOnly = true)
    public WorkspaceResponse requireAccessible(String workspaceKey) {
        return WorkspaceResponse.from(requireAccessibleWorkspace(workspaceKey));
    }

    @Transactional(readOnly = true)
    public List<WorkspaceResponse> listAccessible() {
        TenantAccessContext context = contextHolder.get()
                .orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
        return repository.findTenantWorkspaces(context.organizationId()).stream()
                .filter(this::isAccessible)
                .map(WorkspaceResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public OrganizationWorkspace requireAccessibleWorkspace(String workspaceKey) {
        TenantAccessContext context = contextHolder.get()
                .orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
        OrganizationWorkspace workspace = repository.findTenantWorkspace(context.organizationId(), workspaceKey)
                .orElseThrow(() -> new AccessDeniedException("Workspace is not accessible"));
        if (workspace.getStatus() != WorkspaceStatus.ACTIVE
                || workspace.getProduct().getStatus() != ProductStatus.ACTIVE) {
            throw new AccessDeniedException("Workspace is not accessible");
        }
        entitlementService.requireEffectivePlan(workspace);
        return workspace;
    }

    private boolean isAccessible(OrganizationWorkspace workspace) {
        if (workspace.getStatus() != WorkspaceStatus.ACTIVE
                || workspace.getProduct().getStatus() != ProductStatus.ACTIVE) return false;
        try {
            entitlementService.requireEffectivePlan(workspace);
            return true;
        } catch (AccessDeniedException denied) {
            return false;
        }
    }
}
