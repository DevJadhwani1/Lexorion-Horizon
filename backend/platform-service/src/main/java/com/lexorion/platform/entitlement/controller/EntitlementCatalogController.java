package com.lexorion.platform.entitlement.controller;
import com.lexorion.platform.entitlement.dto.*;
import com.lexorion.platform.entitlement.service.EntitlementCatalogService;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/platform")
@PreAuthorize("@tenantAuthorization.hasAnyRole(T(com.lexorion.platform.membership.entity.OrganizationRole).OWNER, T(com.lexorion.platform.membership.entity.OrganizationRole).ADMIN)")
public class EntitlementCatalogController {
    private final EntitlementCatalogService service;
    public EntitlementCatalogController(EntitlementCatalogService service) { this.service = service; }
    @GetMapping("/plans") public List<PlanCatalogResponse> plans() { return service.plans(); }
    @GetMapping("/entitlements") public List<EntitlementCatalogResponse> entitlements() { return service.definitions(); }
}
