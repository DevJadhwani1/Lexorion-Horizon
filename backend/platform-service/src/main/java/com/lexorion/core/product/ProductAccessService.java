package com.lexorion.core.product;

import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.core.security.CoreIdentityService;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ProductAccessService {
    private final CoreIdentityService identities;
    private final OrganizationRepository organizations;
    private final CoreProductRepository products;
    private final ProductAccessRepository grants;
    private final Clock clock;
    public ProductAccessService(CoreIdentityService identities, OrganizationRepository organizations,
            CoreProductRepository products, ProductAccessRepository grants, Clock clock) {
        this.identities = identities; this.organizations = organizations; this.products = products;
        this.grants = grants; this.clock = clock;
    }
    public void requireAccess(UUID userId, UUID organizationId, String productKey) {
        requireAssociation(userId, organizationId);
        if (!isEffective(organizationId, productKey)) throw new AccessDeniedException("Product access is not valid");
    }
    public List<ProductAccess> accessibleProducts(UUID userId, UUID organizationId) {
        requireAssociation(userId, organizationId);
        return grants.findByOrganizationId(organizationId).stream()
                .filter(g -> isEffective(organizationId, g.getProductKey()))
                .map(g -> new ProductAccess(g.getProductKey(), products.findById(g.getProductKey()).orElseThrow().getDisplayName(), g.getValidUntil()))
                .sorted(java.util.Comparator.comparing(ProductAccess::productKey)).toList();
    }
    private void requireAssociation(UUID userId, UUID organizationId) {
        if (!identities.load(userId).organizationIds().contains(organizationId))
            throw new AccessDeniedException("Active organization membership is required");
    }
    private boolean isEffective(UUID organizationId, String productKey) {
        return organizations.findById(organizationId).filter(o -> o.getStatus().allowsTenantAccess()).isPresent()
                && products.findById(productKey).filter(CoreProduct::isActive).isPresent()
                && grants.findByOrganizationIdAndProductKey(organizationId, productKey).filter(g -> g.isValidAt(clock.instant())).isPresent();
    }
    @Transactional
    public void updateGrant(UUID actorId, UUID organizationId, String productKey, ProductAccessGrant.Status status,
            Instant validFrom, Instant validUntil) {
        if (!identities.load(actorId).coreOperator()) throw new AccessDeniedException("Core operator authority is required");
        // Serialize upserts for one organization, including the first grant.
        organizations.findByIdForUpdate(organizationId).orElseThrow(() -> new IllegalArgumentException("Unknown organization"));
        if (!products.existsById(productKey)) throw new IllegalArgumentException("Unknown product");
        if (validFrom != null && validUntil != null && !validUntil.isAfter(validFrom))
            throw new IllegalArgumentException("validUntil must be after validFrom");
        var grant = grants.findByOrganizationIdAndProductKey(organizationId, productKey).orElseGet(ProductAccessGrant::new);
        grant.setOrganizationId(organizationId); grant.setProductKey(productKey); grant.setStatus(status);
        grant.setValidFrom(validFrom); grant.setValidUntil(validUntil); grants.save(grant);
    }
    public record ProductAccess(String productKey, String displayName, Instant validUntil) {}
}
