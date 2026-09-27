package com.lexorion.horizon.entitlement.entity;

import com.lexorion.core.config.Auditable;
import com.lexorion.core.organization.entity.Organization;
import jakarta.persistence.*;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "organization_plan_assignments", uniqueConstraints = @UniqueConstraint(name = "uk_org_plan_assignment", columnNames = {"organization_id"}), indexes = {@Index(name = "idx_plan_assignment_status", columnList = "status")})
@Getter @Setter @NoArgsConstructor
public class OrganizationPlanAssignment extends Auditable {
    @Id @UuidGenerator @Column(nullable = false, updatable = false) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "organization_id", nullable = false, updatable = false) private Organization organization;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "plan_id", nullable = false) private Plan plan;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private AssignmentStatus status = AssignmentStatus.ACTIVE;
}
