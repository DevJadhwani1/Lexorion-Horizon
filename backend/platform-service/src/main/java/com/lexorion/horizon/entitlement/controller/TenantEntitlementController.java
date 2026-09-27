package com.lexorion.horizon.entitlement.controller;
import com.lexorion.horizon.entitlement.dto.*;
import com.lexorion.horizon.entitlement.service.*;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/tenant")
public class TenantEntitlementController {
    private final EntitlementService entitlements; private final PlanAssignmentService assignments;
    public TenantEntitlementController(EntitlementService entitlements, PlanAssignmentService assignments) { this.entitlements = entitlements; this.assignments = assignments; }
    @GetMapping("/entitlements") @PreAuthorize("@tenantAuthorization.hasAnyRole(T(com.lexorion.horizon.membership.entity.OrganizationRole).ADMIN)")
    public List<EffectiveEntitlementResponse> effective() { return entitlements.effectiveForCurrentOrganization(); }
    @PutMapping("/plan-assignment") @PreAuthorize("@tenantAuthorization.hasAnyRole(T(com.lexorion.horizon.membership.entity.OrganizationRole).ADMIN)")
    public EffectiveEntitlementResponse assign(@Valid @RequestBody AssignPlanRequest request) { return assignments.assign(request.planKey()); }
}
