package com.lexorion.core.product;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ProductAccessRepository extends JpaRepository<ProductAccessGrant, UUID> {
    Optional<ProductAccessGrant> findByOrganizationIdAndProductKey(UUID organizationId, String productKey);
    List<ProductAccessGrant> findByOrganizationId(UUID organizationId);
}
