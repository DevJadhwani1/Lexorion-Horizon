package com.lexorion.horizon.workspace.controller;

import com.lexorion.horizon.workspace.dto.WorkspaceResponse;
import com.lexorion.horizon.workspace.service.WorkspaceAccessService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tenant/workspaces")
public class WorkspaceAccessController {
    private final WorkspaceAccessService service;
    public WorkspaceAccessController(WorkspaceAccessService service) { this.service = service; }
    @GetMapping("/accessible")
    public List<WorkspaceResponse> accessible() { return service.listAccessible(); }
    @GetMapping("/{workspaceKey}")
    public WorkspaceResponse access(@PathVariable String workspaceKey) {
        return service.requireAccessible(workspaceKey);
    }
}
