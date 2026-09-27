package com.lexorion.horizon.entitlement.service;

import com.lexorion.core.exception.ResourceNotFoundException;
import com.lexorion.core.organization.entity.Organization;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.horizon.entitlement.dto.EffectiveEntitlementResponse;
import com.lexorion.horizon.entitlement.entity.*;
import com.lexorion.horizon.entitlement.exception.InvalidPlanAssignmentException;
import com.lexorion.horizon.entitlement.repository.*;
import com.lexorion.horizon.membership.entity.OrganizationRole;
import com.lexorion.horizon.tenantaccess.context.TenantAccessContext;
import com.lexorion.horizon.tenantaccess.context.TenantAccessContextHolder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PlanAssignmentService {
    private final TenantAccessContextHolder contexts;
    private final OrganizationRepository organizations;
    private final PlanRepository plans;
    private final OrganizationPlanAssignmentRepository assignments;
    private final EntitlementService entitlements;

    public PlanAssignmentService(TenantAccessContextHolder contexts, OrganizationRepository organizations,
            PlanRepository plans, OrganizationPlanAssignmentRepository assignments, EntitlementService entitlements) {
        this.contexts = contexts;
        this.organizations = organizations;
        this.plans = plans;
        this.assignments = assignments;
        this.entitlements = entitlements;
    }

    public EffectiveEntitlementResponse assign(String planKey) {
        TenantAccessContext context = administrator();
        Organization organization = organizations.findByIdForUpdate(context.organizationId())
                .orElseThrow(() -> ResourceNotFoundException.of("Organization", context.organizationId()));
        if (!organization.getStatus().allowsTenantManagement())
            throw new AccessDeniedException("Plan assignment requires a TRIAL or ACTIVE organization");
        Plan plan = requireCommercialPlan(planKey);
        OrganizationPlanAssignment assignment = assignments.findForOrganization(organization.getId()).orElseGet(() -> {
            OrganizationPlanAssignment created = new OrganizationPlanAssignment();
            created.setOrganization(organization);
            return created;
        });
        assignment.setPlan(plan);
        assignment.setStatus(AssignmentStatus.ACTIVE);
        assignments.saveAndFlush(assignment);
        return entitlements.effectiveForOrganization(organization.getId());
    }

    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('PLATFORM_ACCESS')")
    public EffectiveEntitlementResponse assignPlatformOrganization(java.util.UUID id, String planKey) {
        Organization organization = organizations.findByIdForUpdate(id)
                .orElseThrow(() -> ResourceNotFoundException.of("Organization", id));
        if (!organization.getStatus().allowsTenantManagement()
                && organization.getStatus() != com.lexorion.core.organization.entity.OrganizationStatus.PENDING)
            throw new InvalidPlanAssignmentException("Organization cannot be provisioned in its current status");
        OrganizationPlanAssignment assignment = assignments.findForOrganization(id).orElseGet(() -> {
            OrganizationPlanAssignment created = new OrganizationPlanAssignment();
            created.setOrganization(organization);
            return created;
        });
        assignment.setPlan(requireCommercialPlan(planKey));
        assignment.setStatus(AssignmentStatus.ACTIVE);
        assignments.saveAndFlush(assignment);
        return entitlements.effectiveForOrganization(id);
    }

    private Plan requireCommercialPlan(String key) {
        if (!"starter".equals(key) && !"business".equals(key))
            throw new InvalidPlanAssignmentException("Only Starter and Business plans are available");
        Plan plan = plans.findByKey(key).orElseThrow(() -> new InvalidPlanAssignmentException("Plan is unavailable"));
        if (plan.getProduct() != null || plan.getStatus() != CatalogStatus.ACTIVE)
            throw new InvalidPlanAssignmentException("An active platform plan is required");
        return plan;
    }

    private TenantAccessContext administrator() {
        TenantAccessContext context = contexts.get().orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
        if (context.membershipRole() != OrganizationRole.ADMIN) throw new AccessDeniedException("Plan assignment requires ADMIN");
        return context;
    }
}
