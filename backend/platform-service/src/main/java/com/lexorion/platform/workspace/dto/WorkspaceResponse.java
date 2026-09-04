package com.lexorion.platform.workspace.dto;

import com.lexorion.platform.workspace.entity.OrganizationWorkspace;
import com.lexorion.platform.workspace.entity.WorkspaceStatus;

public record WorkspaceResponse(String key, String displayName, WorkspaceStatus status,
                                String productKey, String productName) {
    public static WorkspaceResponse from(OrganizationWorkspace workspace) {
        return new WorkspaceResponse(workspace.getKey(), workspace.getDisplayName(), workspace.getStatus(),
                workspace.getProduct().getKey(), workspace.getProduct().getDisplayName());
    }
}
