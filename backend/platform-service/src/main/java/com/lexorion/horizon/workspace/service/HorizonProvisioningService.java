package com.lexorion.horizon.workspace.service;
import com.lexorion.core.product.ProductAccessGrant;
import com.lexorion.core.product.ProductAccessRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
/** Explicit product enrollment used by the existing Horizon organization onboarding flow. */
@Service
public class HorizonProvisioningService {
    private final ProductAccessRepository grants;
    public HorizonProvisioningService(ProductAccessRepository grants) { this.grants = grants; }
    @Transactional
    public void enroll(UUID organizationId) {
        if (grants.findByOrganizationIdAndProductKey(organizationId, "horizon").isPresent()) return;
        var grant = new ProductAccessGrant();
        grant.setOrganizationId(organizationId); grant.setProductKey("horizon");
        grant.setStatus(ProductAccessGrant.Status.ACTIVE); grants.save(grant);
    }
}
