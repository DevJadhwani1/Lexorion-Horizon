package com.lexorion.horizon.workspace.controller;

import com.lexorion.horizon.workspace.dto.CreateWorkspaceRequest;
import com.lexorion.horizon.workspace.dto.UpdateWorkspaceRequest;
import com.lexorion.horizon.workspace.dto.WorkspaceResponse;
import com.lexorion.horizon.workspace.service.WorkspaceAdministrationService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tenant/workspaces")
@PreAuthorize("@tenantAuthorization.hasAnyRole(T(com.lexorion.horizon.membership.entity.OrganizationRole).ADMIN)")
public class WorkspaceAdministrationController {
    private final WorkspaceAdministrationService service;
    public WorkspaceAdministrationController(WorkspaceAdministrationService service) { this.service = service; }
    @GetMapping public List<WorkspaceResponse> list() { return service.list(); }
    @PostMapping public ResponseEntity<WorkspaceResponse> create(@Valid @RequestBody CreateWorkspaceRequest request) {
        WorkspaceResponse response = service.create(request);
        return ResponseEntity.created(URI.create("/api/tenant/workspaces/" + response.key())).body(response);
    }
    @PatchMapping("/{workspaceKey}")
    public WorkspaceResponse update(@PathVariable String workspaceKey,
                                    @Valid @RequestBody UpdateWorkspaceRequest request) {
        return service.update(workspaceKey, request);
    }
    @DeleteMapping("/{workspaceKey}")
    public ResponseEntity<Void> deactivate(@PathVariable String workspaceKey) {
        service.deactivate(workspaceKey); return ResponseEntity.noContent().build();
    }
}
