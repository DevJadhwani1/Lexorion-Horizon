package com.lexorion.horizon.entitlement.service;

import com.lexorion.horizon.entitlement.dto.*;
import com.lexorion.horizon.entitlement.entity.*;
import com.lexorion.horizon.entitlement.exception.InvalidPlanAssignmentException;
import com.lexorion.horizon.entitlement.repository.*;
import com.lexorion.core.exception.DuplicateResourceException;
import com.lexorion.horizon.membership.entity.OrganizationRole;
import com.lexorion.core.organization.entity.Organization;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.horizon.product.entity.*;
import com.lexorion.horizon.product.repository.ProductRepository;
import com.lexorion.horizon.tenantaccess.context.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional
public class PlanAssignmentService {
    private final TenantAccessContextHolder contexts; private final OrganizationRepository organizations; private final ProductRepository products;
    private final PlanRepository plans; private final OrganizationPlanAssignmentRepository assignments;
    public PlanAssignmentService(TenantAccessContextHolder contexts, OrganizationRepository organizations, ProductRepository products, PlanRepository plans, OrganizationPlanAssignmentRepository assignments) {
        this.contexts = contexts; this.organizations = organizations; this.products = products; this.plans = plans; this.assignments = assignments;
    }
    public EffectiveEntitlementResponse assign(String productKey, AssignPlanRequest request, EntitlementService entitlementService) {
        TenantAccessContext context = administrator();
        Organization organization = organizations.findByIdForUpdate(context.organizationId()).orElseThrow(() -> new AccessDeniedException("Organization is unavailable"));
        if (!organization.getStatus().allowsTenantManagement()) throw new AccessDeniedException("Plan assignment requires a TRIAL or ACTIVE organization");
        Product product = products.findByKey(productKey).orElseThrow(() -> new InvalidPlanAssignmentException("Product is unavailable"));
        Plan plan = plans.findByKey(request.planKey()).orElseThrow(() -> new InvalidPlanAssignmentException("Plan is unavailable"));
        if (product.getStatus() != ProductStatus.ACTIVE || plan.getStatus() != CatalogStatus.ACTIVE) throw new InvalidPlanAssignmentException("Product and plan must be active");
        if (plan.getProduct() != null ? !plan.getProduct().getId().equals(product.getId())
                : !entitlementService.enablesProduct(plan, productKey)) throw new InvalidPlanAssignmentException("Plan does not enable the selected product");
        if (plan.getProduct() == null) {
            assignCommercial(organization, plan, entitlementService);
            return entitlementService.effectiveForCurrentOrganization().stream().filter(item -> item.productKey().equals(productKey)).findFirst().orElseThrow();
        }
        if (assignments.findForOrganization(organization.getId()).stream().anyMatch(a -> a.getStatus() == AssignmentStatus.ACTIVE && a.getPlan().getProduct() == null))
            throw new DuplicateResourceException("An organization commercial plan is already assigned");
        if (assignments.findForOrganizationAndProduct(context.organizationId(), product.getId()).filter(a -> a.getStatus() == AssignmentStatus.ACTIVE).isPresent()) {
            throw new DuplicateResourceException("An active plan is already assigned for product: " + productKey);
        }
        OrganizationPlanAssignment assignment = assignments.findForOrganizationAndProduct(context.organizationId(), product.getId()).orElseGet(OrganizationPlanAssignment::new);
        if (assignment.getId() == null) { assignment.setOrganization(organization); assignment.setProduct(product); }
        assignment.setPlan(plan); assignment.setStatus(AssignmentStatus.ACTIVE); assignments.saveAndFlush(assignment);
        return entitlementService.effectiveForCurrentOrganization().stream().filter(item -> item.productKey().equals(productKey)).findFirst().orElseThrow();
    }
    public void deactivate(String productKey) {
        TenantAccessContext context = administrator();
        Organization organization = organizations.findByIdForUpdate(context.organizationId()).orElseThrow(() -> new AccessDeniedException("Organization is unavailable"));
        if (!organization.getStatus().allowsTenantManagement()) throw new AccessDeniedException("Plan assignment requires a TRIAL or ACTIVE organization");
        Product product = products.findByKey(productKey).orElseThrow(() -> new InvalidPlanAssignmentException("Product is unavailable"));
        OrganizationPlanAssignment assignment = assignments.findForOrganizationAndProduct(context.organizationId(), product.getId()).orElseThrow(() -> new InvalidPlanAssignmentException("Plan assignment is unavailable"));
        if (assignment.getPlan().getProduct() == null) {
            assignments.findForOrganization(organization.getId()).stream().filter(a -> a.getPlan().getId().equals(assignment.getPlan().getId())).forEach(a -> a.setStatus(AssignmentStatus.INACTIVE));
        } else assignment.setStatus(AssignmentStatus.INACTIVE);
        assignments.flush();
    }
    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('PLATFORM_ACCESS')")
    public void assignPlatformOrganization(java.util.UUID id, String planKey, EntitlementService entitlementService) {
        Organization organization = organizations.findByIdForUpdate(id).orElseThrow(() -> new InvalidPlanAssignmentException("Organization is unavailable"));
        if (!organization.getStatus().allowsTenantManagement() && organization.getStatus() != com.lexorion.core.organization.entity.OrganizationStatus.PENDING)
            throw new InvalidPlanAssignmentException("Organization cannot be provisioned in its current status");
        Plan plan = plans.findByKey(planKey).orElseThrow(() -> new InvalidPlanAssignmentException("Plan is unavailable"));
        if (plan.getProduct() != null || plan.getStatus() != CatalogStatus.ACTIVE) throw new InvalidPlanAssignmentException("An active commercial plan is required");
        assignCommercial(organization, plan, entitlementService);
    }
    private void assignCommercial(Organization organization, Plan plan, EntitlementService entitlementService) {
        var current = assignments.findForOrganization(organization.getId());
        if (current.stream().anyMatch(a -> a.getStatus() == AssignmentStatus.ACTIVE && !a.getPlan().getId().equals(plan.getId())))
            throw new DuplicateResourceException("Existing plan assignments must be explicitly deactivated before changing the commercial plan");
        var enabled = products.findAll().stream().filter(p -> p.getStatus() == ProductStatus.ACTIVE && entitlementService.enablesProduct(plan, p.getKey())).toList();
        if (enabled.isEmpty()) throw new InvalidPlanAssignmentException("Plan has no available products");
        for (Product product : enabled) {
            var assignment = assignments.findForOrganizationAndProduct(organization.getId(), product.getId()).orElseGet(OrganizationPlanAssignment::new);
            if (assignment.getId() == null) { assignment.setOrganization(organization); assignment.setProduct(product); }
            assignment.setPlan(plan); assignment.setStatus(AssignmentStatus.ACTIVE); assignments.save(assignment);
        }
        assignments.flush();
    }
    private TenantAccessContext administrator() {
        TenantAccessContext context = contexts.get().orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
        if (context.membershipRole() != OrganizationRole.ADMIN) throw new AccessDeniedException("Plan assignment requires ADMIN");
        return context;
    }
}
