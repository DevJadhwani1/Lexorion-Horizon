package com.lexorion.platform.entitlement.controller;
import com.lexorion.platform.entitlement.dto.*;
import com.lexorion.platform.entitlement.service.*;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/tenant")
public class TenantEntitlementController {
    private final EntitlementService entitlements; private final PlanAssignmentService assignments;
    public TenantEntitlementController(EntitlementService entitlements, PlanAssignmentService assignments) { this.entitlements = entitlements; this.assignments = assignments; }
    @GetMapping("/entitlements") @PreAuthorize("@tenantAuthorization.hasAnyRole(T(com.lexorion.platform.membership.entity.OrganizationRole).OWNER, T(com.lexorion.platform.membership.entity.OrganizationRole).ADMIN)")
    public List<EffectiveEntitlementResponse> effective() { return entitlements.effectiveForCurrentOrganization(); }
    @PostMapping("/plan-assignments/{productKey}") @PreAuthorize("@tenantAuthorization.hasAnyRole(T(com.lexorion.platform.membership.entity.OrganizationRole).OWNER, T(com.lexorion.platform.membership.entity.OrganizationRole).ADMIN)")
    public ResponseEntity<EffectiveEntitlementResponse> assign(@PathVariable String productKey, @Valid @RequestBody AssignPlanRequest request) { return ResponseEntity.status(HttpStatus.CREATED).body(assignments.assign(productKey, request, entitlements)); }
    @DeleteMapping("/plan-assignments/{productKey}") @PreAuthorize("@tenantAuthorization.hasAnyRole(T(com.lexorion.platform.membership.entity.OrganizationRole).OWNER, T(com.lexorion.platform.membership.entity.OrganizationRole).ADMIN)")
    public ResponseEntity<Void> deactivate(@PathVariable String productKey) { assignments.deactivate(productKey); return ResponseEntity.noContent().build(); }
}
