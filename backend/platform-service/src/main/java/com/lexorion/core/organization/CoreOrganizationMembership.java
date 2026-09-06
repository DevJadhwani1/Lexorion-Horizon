package com.lexorion.core.organization;

import jakarta.persistence.*;
import java.util.UUID;
import org.hibernate.annotations.Immutable;

/** Role-free association projection over the existing membership store. */
@Entity(name = "CoreOrganizationMembership")
@Table(name = "organization_memberships")
@Immutable
public class CoreOrganizationMembership {
    @Id private UUID id;
    @Column(name = "user_id", insertable = false, updatable = false) private UUID userId;
    @Column(name = "organization_id", insertable = false, updatable = false) private UUID organizationId;
    @Column(insertable = false, updatable = false) private String status;
    public UUID getOrganizationId() { return organizationId; }
}
