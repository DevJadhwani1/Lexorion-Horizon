package com.lexorion.horizon.workspace.service;

import com.lexorion.horizon.product.entity.ProductStatus;
import com.lexorion.horizon.entitlement.service.EntitlementService;
import com.lexorion.horizon.tenantaccess.context.TenantAccessContext;
import com.lexorion.horizon.tenantaccess.context.TenantAccessContextHolder;
import com.lexorion.horizon.workspace.dto.WorkspaceResponse;
import com.lexorion.horizon.workspace.entity.OrganizationWorkspace;
import com.lexorion.horizon.workspace.entity.WorkspaceStatus;
import com.lexorion.horizon.workspace.repository.OrganizationWorkspaceRepository;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Horizon workspace policy, evaluated after Core product entry. */
@Service
public class WorkspaceAccessService {
    private final com.lexorion.core.product.ProductAccessService coreAccess;
    private final TenantAccessContextHolder contextHolder;
    private final OrganizationWorkspaceRepository repository;
    private final EntitlementService entitlementService;
    public WorkspaceAccessService(TenantAccessContextHolder contextHolder, OrganizationWorkspaceRepository repository,
                                  EntitlementService entitlementService, com.lexorion.core.product.ProductAccessService coreAccess) {
        this.coreAccess = coreAccess;
        this.contextHolder = contextHolder; this.repository = repository; this.entitlementService = entitlementService;
    }

    @Transactional(readOnly = true)
    public WorkspaceResponse requireAccessible(String workspaceKey) {
        return response(requireAccessibleWorkspace(workspaceKey));
    }

    @Transactional(readOnly = true)
    public List<WorkspaceResponse> listAccessible() {
        TenantAccessContext context = contextHolder.get()
                .orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
        coreAccess.requireAccess(context.userId(), context.organizationId(), "horizon");
        return repository.findTenantWorkspaces(context.organizationId()).stream()
                .filter(this::isAccessible)
                .map(this::response)
                .toList();
    }

    @Transactional(readOnly = true)
    public OrganizationWorkspace requireAccessibleWorkspace(String workspaceKey) {
        TenantAccessContext context = contextHolder.get()
                .orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
        coreAccess.requireAccess(context.userId(), context.organizationId(), "horizon");
        OrganizationWorkspace workspace = repository.findTenantWorkspace(context.organizationId(), workspaceKey)
                .orElseThrow(() -> new AccessDeniedException("Workspace is not accessible"));
        if (!isAccessible(workspace)) {
            throw new AccessDeniedException("Workspace is not accessible");
        }
        return workspace;
    }
    @Transactional(readOnly = true)
    public OrganizationWorkspace requireAccessibleWorkspace(String key, String productKey) {
        var workspace = requireAccessibleWorkspace(key);
        entitlementService.requireEffectivePlan(workspace, productKey);
        return workspace;
    }
    private WorkspaceResponse response(OrganizationWorkspace workspace) {
        var enabled = workspace.availableProducts().stream().filter(p -> productAccessible(workspace, p.getKey()))
            .sorted(java.util.Comparator.comparing(com.lexorion.horizon.product.entity.Product::getKey))
            .map(p -> new WorkspaceResponse.ProductSummary(p.getKey(), p.getDisplayName())).toList();
        return new WorkspaceResponse(workspace.getKey(), workspace.getDisplayName(), workspace.getStatus(), enabled.getFirst().key(), enabled.getFirst().displayName(), enabled);
    }
    private boolean productAccessible(OrganizationWorkspace workspace, String productKey) {
        try { entitlementService.requireEffectivePlan(workspace, productKey); return true; }
        catch (AccessDeniedException denied) { return false; }
    }

    private boolean isAccessible(OrganizationWorkspace workspace) {
        return workspace.getStatus() == WorkspaceStatus.ACTIVE && workspace.availableProducts().stream().anyMatch(p -> productAccessible(workspace, p.getKey()));
    }
}
