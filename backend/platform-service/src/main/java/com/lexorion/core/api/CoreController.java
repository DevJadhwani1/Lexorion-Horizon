package com.lexorion.core.api;

import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.core.product.*;
import com.lexorion.core.security.CoreIdentityService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/core")
public class CoreController {
    private final CoreIdentityService identities;
    private final OrganizationRepository organizations;
    private final ProductAccessService access;
    private final CoreProductRepository products;
    public CoreController(CoreIdentityService identities, OrganizationRepository organizations, ProductAccessService access, CoreProductRepository products) {
        this.identities = identities; this.organizations = organizations; this.access = access; this.products = products;
    }
    @GetMapping("/me") public CoreIdentityService.Identity me(Principal principal) { return identities.load(id(principal)); }
    @GetMapping("/me/organizations") public List<OrganizationSummary> organizations(Principal principal) {
        return organizations.findAllById(me(principal).organizationIds()).stream()
                .map(o -> new OrganizationSummary(o.getId(), o.getName(), o.getStatus().name()))
                .sorted(java.util.Comparator.comparing(OrganizationSummary::name)).toList();
    }
    @GetMapping("/products") public List<ProductSummary> products() {
        return products.findAll().stream().sorted(java.util.Comparator.comparing(CoreProduct::getKey))
                .map(p -> new ProductSummary(p.getKey(), p.getDisplayName(), p.isActive())).toList();
    }
    @GetMapping("/me/organizations/{organizationId}/products")
    public List<ProductAccessService.ProductAccess> access(Principal principal, @PathVariable UUID organizationId) {
        return access.accessibleProducts(id(principal), organizationId);
    }
    @PutMapping("/organizations/{organizationId}/products/{productKey}")
    public void update(Principal principal, @PathVariable UUID organizationId, @PathVariable String productKey,
            @RequestBody @Valid GrantRequest request) {
        access.updateGrant(id(principal), organizationId, productKey, request.status(), request.validFrom(), request.validUntil());
    }
    private UUID id(Principal principal) { return UUID.fromString(principal.getName()); }
    public record OrganizationSummary(UUID id, String name, String status) {}
    public record ProductSummary(String key, String displayName, boolean active) {}
    public record GrantRequest(@NotNull ProductAccessGrant.Status status, Instant validFrom, Instant validUntil) {}
}
