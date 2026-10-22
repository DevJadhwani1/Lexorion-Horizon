package com.lexorion.horizon.workspace.controller;

import com.lexorion.horizon.tenantaccess.context.TenantAccessContext;
import com.lexorion.horizon.tenantaccess.context.TenantAccessContextHolder;
import com.lexorion.horizon.workspace.dto.InternalFinanceContextResponse;
import com.lexorion.horizon.workspace.entity.OrganizationWorkspace;
import com.lexorion.horizon.workspace.service.WorkspaceAccessService;
import jakarta.validation.constraints.Pattern;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Resolves the delegated user's authority for a Finance workspace. Finance is available while the product is attached and the organization plan is effective. */
@RestController
@Validated
@RequestMapping("/internal/finance/workspaces")
public class InternalFinanceAuthorityController {
    private final WorkspaceAccessService workspaces;
    private final TenantAccessContextHolder contexts;

    public InternalFinanceAuthorityController(WorkspaceAccessService workspaces, TenantAccessContextHolder contexts) {
        this.workspaces = workspaces;
        this.contexts = contexts;
    }

    @GetMapping("/{workspaceKey}/context")
    public InternalFinanceContextResponse context(@PathVariable @Pattern(regexp = "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$") String workspaceKey) {
        OrganizationWorkspace workspace = workspaces.requireAccessibleWorkspace(workspaceKey, "finance");
        TenantAccessContext context = contexts.get()
                .orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
        if (!workspace.getOrganization().getId().equals(context.organizationId())) {
            throw new AccessDeniedException("Workspace is not accessible");
        }
        return new InternalFinanceContextResponse(workspace.getId(), workspace.getKey(),
                workspace.getOrganization().getId(), context.organizationSlug(),
                context.membershipRole().name(), context.userId());
    }
}
