package com.lexorion.platform.entitlement.service;

import com.lexorion.platform.entitlement.dto.*;
import com.lexorion.platform.entitlement.entity.*;
import com.lexorion.platform.entitlement.exception.InvalidPlanAssignmentException;
import com.lexorion.platform.entitlement.repository.*;
import com.lexorion.platform.exception.DuplicateResourceException;
import com.lexorion.platform.membership.entity.OrganizationRole;
import com.lexorion.platform.organization.entity.Organization;
import com.lexorion.platform.organization.repository.OrganizationRepository;
import com.lexorion.platform.product.entity.*;
import com.lexorion.platform.product.repository.ProductRepository;
import com.lexorion.platform.tenantaccess.context.*;
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
        if (!plan.getProduct().getId().equals(product.getId())) throw new InvalidPlanAssignmentException("Plan does not belong to the selected product");
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
        assignment.setStatus(AssignmentStatus.INACTIVE); assignments.saveAndFlush(assignment);
    }
    private TenantAccessContext administrator() {
        TenantAccessContext context = contexts.get().orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
        if (context.membershipRole() != OrganizationRole.OWNER && context.membershipRole() != OrganizationRole.ADMIN) throw new AccessDeniedException("Plan assignment requires OWNER or ADMIN");
        return context;
    }
}
