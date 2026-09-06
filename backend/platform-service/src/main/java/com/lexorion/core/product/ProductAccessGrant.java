package com.lexorion.core.product;

import com.lexorion.core.config.Auditable;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "core_product_access", uniqueConstraints = @UniqueConstraint(columnNames = {"organization_id", "product_key"}))
@Getter @Setter
public class ProductAccessGrant extends Auditable {
    @Id @UuidGenerator private UUID id;
    @Column(name = "organization_id", nullable = false) private UUID organizationId;
    @Column(name = "product_key", nullable = false, length = 63) private String productKey;
    @Column(nullable = false, length = 20) @Enumerated(EnumType.STRING) private Status status;
    private Instant validFrom;
    private Instant validUntil;
    public enum Status { ACTIVE, SUSPENDED, REVOKED }
    public boolean isValidAt(Instant now) {
        return status == Status.ACTIVE && (validFrom == null || !now.isBefore(validFrom))
                && (validUntil == null || now.isBefore(validUntil));
    }
}
