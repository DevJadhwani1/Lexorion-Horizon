package com.lexorion.core.organization;

import com.lexorion.core.config.Auditable;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

/** Core owns the association row; products own their authorization extensions. */
@Entity(name = "CoreOrganizationMembership")
@Table(name = "organization_memberships", uniqueConstraints = @UniqueConstraint(name = "uk_org_membership_org_user", columnNames = {"organization_id", "user_id"}))
@Getter @Setter
public class CoreOrganizationMembership extends Auditable {
    @Id @UuidGenerator private UUID id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "organization_id", nullable = false) private UUID organizationId;
    @Column(nullable = false, length = 20) private String status;
    @Column(name = "joined_at", nullable = false) private Instant joinedAt;
}
