package com.lexorion.horizon.workspace.controller;
import com.lexorion.horizon.entitlement.service.EntitlementService;
import com.lexorion.horizon.tenantaccess.context.TenantAccessContextHolder;
import com.lexorion.horizon.workspace.dto.*;
import com.lexorion.horizon.workspace.entity.OrganizationWorkspace;
import com.lexorion.horizon.workspace.service.WorkspaceAccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.annotation.Validated;
import com.lexorion.horizon.membership.entity.MembershipStatus;
import com.lexorion.horizon.membership.entity.OrganizationRole;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import com.lexorion.core.user.entity.UserStatus;
import com.lexorion.core.user.repository.UserRepository;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;
@RestController @Validated @RequestMapping("/internal/workforce/workspaces")
public class InternalWorkforceAuthorityController {
    private final WorkspaceAccessService workspaces; private final EntitlementService entitlements; private final TenantAccessContextHolder contexts; private final UserRepository users; private final OrganizationMembershipRepository memberships;
    public InternalWorkforceAuthorityController(WorkspaceAccessService workspaces, EntitlementService entitlements, TenantAccessContextHolder contexts, UserRepository users, OrganizationMembershipRepository memberships) { this.workspaces = workspaces; this.entitlements = entitlements; this.contexts = contexts; this.users = users; this.memberships = memberships; }
    @GetMapping("/{workspaceKey}/context") public InternalWorkforceContextResponse context(@PathVariable @Pattern(regexp="^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$") String workspaceKey) {
        OrganizationWorkspace workspace = workforceWorkspace(workspaceKey);
        var context = contexts.get().orElseThrow();
        return response(workspace, context);
    }
    @PostMapping("/{workspaceKey}/employee-limit") public InternalWorkforceContextResponse employeeLimit(@PathVariable @Pattern(regexp="^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$") String workspaceKey, @Valid @RequestBody InternalLimitRequest request) {
        OrganizationWorkspace workspace = workforceWorkspace(workspaceKey);
        entitlements.requireIntegerLimit(workspace, "workforce.employee_limit", request.requestedValue());
        var context = contexts.get().orElseThrow();
        return response(workspace, context);
    }
    @PostMapping("/{workspaceKey}/user-resolution") public UserResolutionResponse resolveUser(@PathVariable @Pattern(regexp="^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$") String workspaceKey, @Valid @RequestBody UserResolutionRequest request) {
        workforceWorkspace(workspaceKey);
        var context = contexts.get().orElseThrow();
        if (context.membershipRole() != OrganizationRole.ADMIN) throw new AccessDeniedException("Organization administrator authority is required");
        var user = users.findByEmailIgnoreCase(request.email().trim()).filter(value -> value.getStatus() == UserStatus.ACTIVE).orElseThrow(() -> new AccessDeniedException("Active organization member not found"));
        memberships.findByUserIdAndOrganizationIdAndStatus(user.getId(), context.organizationId(), MembershipStatus.ACTIVE).orElseThrow(() -> new AccessDeniedException("Active organization member not found"));
        return new UserResolutionResponse(user.getId());
    }
    public record UserResolutionRequest(@NotBlank @Email String email) {}
    public record UserResolutionResponse(UUID userId) {}
    private InternalWorkforceContextResponse response(OrganizationWorkspace workspace, com.lexorion.horizon.tenantaccess.context.TenantAccessContext context) {
        if (!workspace.getOrganization().getId().equals(context.organizationId())) throw new AccessDeniedException("Workspace is not accessible");
        return new InternalWorkforceContextResponse(workspace.getId(), workspace.getKey(), workspace.getOrganization().getId(), context.organizationSlug(), context.membershipRole().name(), context.userId());
    }
    private OrganizationWorkspace workforceWorkspace(String key) {
        OrganizationWorkspace workspace = workspaces.requireAccessibleWorkspace(key, "workforce");
        return workspace;
    }
}
