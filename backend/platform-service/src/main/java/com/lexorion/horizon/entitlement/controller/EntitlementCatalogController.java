package com.lexorion.horizon.entitlement.controller;
import com.lexorion.horizon.entitlement.dto.*;
import com.lexorion.horizon.entitlement.service.EntitlementCatalogService;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/platform")
@PreAuthorize("hasAuthority('PLATFORM_ACCESS') or @tenantAuthorization.hasAnyRole(T(com.lexorion.horizon.membership.entity.OrganizationRole).ADMIN)")
public class EntitlementCatalogController {
    private final EntitlementCatalogService service;
    public EntitlementCatalogController(EntitlementCatalogService service) { this.service = service; }
    @GetMapping("/plans") public List<PlanCatalogResponse> plans() { return service.plans(); }
    @GetMapping("/entitlements") public List<EntitlementCatalogResponse> entitlements() { return service.definitions(); }
}
