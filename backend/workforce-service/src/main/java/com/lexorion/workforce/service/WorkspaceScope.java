package com.lexorion.workforce.service;

import com.lexorion.workforce.domain.WorkforceWorkspace;
import com.lexorion.workforce.repository.WorkforceWorkspaceRepository;
import com.lexorion.workforce.tenant.TrustedWorkforceContext;
import com.lexorion.workforce.tenant.TrustedWorkforceContextHolder;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class WorkspaceScope {
    private final TrustedWorkforceContextHolder contexts;
    private final WorkforceWorkspaceRepository workspaces;
    private final WorkforceWorkspaceProvisioner provisioner;

    public WorkspaceScope(TrustedWorkforceContextHolder contexts, WorkforceWorkspaceRepository workspaces,
            WorkforceWorkspaceProvisioner provisioner) {
        this.contexts = contexts;
        this.workspaces = workspaces;
        this.provisioner = provisioner;
    }

    public TrustedWorkforceContext context() {
        return contexts.get().orElseThrow(() -> new IllegalStateException("Trusted workspace context required"));
    }

    public WorkforceWorkspace workspace() {
        var context = context();
        return workspaces.findById(context.workspaceId()).orElseGet(() -> {
            WorkforceWorkspace workspace = new WorkforceWorkspace();
            workspace.setId(context.workspaceId());
            workspace.setKey(context.workspaceKey());
            return workspaces.saveAndFlush(workspace);
        });
    }

    public WorkforceWorkspace lockedWorkspace() {
        WorkforceWorkspace workspace = workspace();
        return workspaces.findByIdForUpdate(workspace.getId()).orElseThrow();
    }

    public WorkforceWorkspace lockedWorkspaceCapacity() {
        TrustedWorkforceContext context = context();
        var ids = context.organizationWorkspaceIds().stream().sorted().toList();
        for (UUID id : ids) {
            String key = id.equals(context.workspaceId()) ? context.workspaceKey() : "workspace-" + id;
            provisioner.ensureExists(id, key);
        }
        for (UUID id : ids) workspaces.findByIdForUpdate(id).orElseThrow();
        return workspaces.findById(context.workspaceId()).orElseThrow();
    }
}
