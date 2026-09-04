package com.lexorion.platform.workspace.controller;

import com.lexorion.platform.entitlement.service.EntitlementService;
import com.lexorion.platform.tenantaccess.context.TenantAccessContext;
import com.lexorion.platform.tenantaccess.context.TenantAccessContextHolder;
import com.lexorion.platform.workspace.dto.InternalCapabilityResponse;
import com.lexorion.platform.workspace.dto.InternalPayrollContextResponse;
import com.lexorion.platform.workspace.entity.OrganizationWorkspace;
import com.lexorion.platform.workspace.service.WorkspaceAccessService;
import jakarta.validation.constraints.Pattern;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/internal/payroll/workspaces")
public class InternalPayrollAuthorityController {
    private static final String PROCESSING = "payroll.processing";
    private final WorkspaceAccessService workspaces;
    private final EntitlementService entitlements;
    private final TenantAccessContextHolder contexts;

    public InternalPayrollAuthorityController(WorkspaceAccessService workspaces,
            EntitlementService entitlements, TenantAccessContextHolder contexts) {
        this.workspaces = workspaces;
        this.entitlements = entitlements;
        this.contexts = contexts;
    }

    @GetMapping("/{workspaceKey}/context")
    public InternalPayrollContextResponse context(@PathVariable @Pattern(regexp = "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$") String workspaceKey) {
        OrganizationWorkspace workspace = payrollWorkspace(workspaceKey);
        TenantAccessContext context = currentContext(workspace);
        return new InternalPayrollContextResponse(workspace.getId(), workspace.getKey(),
                workspace.getOrganization().getId(), context.organizationSlug(),
                context.membershipRole().name(), context.userId());
    }

    @GetMapping("/{workspaceKey}/capabilities/payroll-processing")
    public InternalCapabilityResponse payrollProcessing(@PathVariable @Pattern(regexp = "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$") String workspaceKey) {
        OrganizationWorkspace workspace = payrollWorkspace(workspaceKey);
        currentContext(workspace);
        entitlements.requireEntitlement(workspace, PROCESSING);
        return new InternalCapabilityResponse(PROCESSING, true);
    }

    private OrganizationWorkspace payrollWorkspace(String key) {
        OrganizationWorkspace workspace = workspaces.requireAccessibleWorkspace(key);
        if (!"payroll".equals(workspace.getProduct().getKey())) {
            throw new AccessDeniedException("Payroll workspace is required");
        }
        return workspace;
    }

    private TenantAccessContext currentContext(OrganizationWorkspace workspace) {
        TenantAccessContext context = contexts.get()
                .orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
        if (!workspace.getOrganization().getId().equals(context.organizationId())) {
            throw new AccessDeniedException("Workspace is not accessible");
        }
        return context;
    }
}
