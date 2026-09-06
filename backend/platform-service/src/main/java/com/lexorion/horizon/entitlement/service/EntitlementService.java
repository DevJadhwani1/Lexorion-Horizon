package com.lexorion.horizon.entitlement.service;

import com.lexorion.horizon.entitlement.dto.EffectiveEntitlementResponse;
import com.lexorion.horizon.entitlement.EntitlementKey;
import com.lexorion.horizon.entitlement.exception.EntitlementDeniedException;
import com.lexorion.horizon.entitlement.exception.InvalidEntitlementValueException;
import com.lexorion.horizon.entitlement.entity.*;
import com.lexorion.horizon.entitlement.repository.*;
import com.lexorion.horizon.product.entity.*;
import com.lexorion.horizon.tenantaccess.context.*;
import com.lexorion.horizon.workspace.entity.OrganizationWorkspace;
import java.util.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EntitlementService {
    private final TenantAccessContextHolder contexts; private final OrganizationPlanAssignmentRepository assignments; private final PlanEntitlementRepository values;
    public EntitlementService(TenantAccessContextHolder contexts, OrganizationPlanAssignmentRepository assignments, PlanEntitlementRepository values) { this.contexts = contexts; this.assignments = assignments; this.values = values; }

    @Transactional(readOnly = true)
    public List<EffectiveEntitlementResponse> effectiveForCurrentOrganization() {
        TenantAccessContext context = contexts.get().orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
        return assignments.findForOrganization(context.organizationId()).stream().filter(this::isEffective).map(this::response).toList();
    }

    @Transactional(readOnly = true)
    public OrganizationPlanAssignment requireEffectivePlan(OrganizationWorkspace workspace) {
        return requireEffectivePlan(workspace, workspace.getProduct().getKey());
    }
    public OrganizationPlanAssignment requireEffectivePlan(OrganizationWorkspace workspace, String productKey) {
        TenantAccessContext context = contexts.get().orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
        if (!workspace.getOrganization().getId().equals(context.organizationId())) throw new AccessDeniedException("Workspace is not accessible");
        var product = workspace.availableProducts().stream().filter(p -> p.getKey().equals(productKey) && p.getStatus() == ProductStatus.ACTIVE).findFirst()
                .orElseThrow(() -> new AccessDeniedException("Product is not attached or active"));
        OrganizationPlanAssignment assignment = assignments.findForOrganizationAndProduct(context.organizationId(), product.getId())
                .orElseThrow(() -> new AccessDeniedException("An active plan is required for workspace access"));
        if (!isEffective(assignment)) throw new AccessDeniedException("An active plan is required for workspace access");
        return assignment;
    }

    @Transactional(readOnly = true)
    public boolean hasEntitlement(OrganizationWorkspace workspace, String key) {
        EntitlementKey.requireValid(key);
        Plan plan = requireEffectivePlan(workspace, key.substring(0, key.indexOf('.'))).getPlan();
        return values.findForPlan(plan.getId()).stream().anyMatch(value -> isActiveBoolean(value, key)
                && Boolean.TRUE.equals(value.getBooleanValue()));
    }

    @Transactional(readOnly = true)
    public int getIntegerLimit(OrganizationWorkspace workspace, String key) {
        EntitlementKey.requireValid(key);
        Plan plan = requireEffectivePlan(workspace, key.substring(0, key.indexOf('.'))).getPlan();
        String configuredKey = plan.getProduct() == null && key.equals("workforce.employee_limit") ? "platform.employee_limit" : key;
        PlanEntitlement value = values.findForPlan(plan.getId()).stream().filter(candidate -> isActiveInteger(candidate, configuredKey))
                .findFirst().orElseThrow(() -> new EntitlementDeniedException("Integer entitlement is not available: " + key));
        if (value.getIntegerValue() == null || value.getIntegerValue() < 0 || value.getBooleanValue() != null) {
            throw new InvalidEntitlementValueException("Invalid configured integer entitlement: " + key);
        }
        return value.getIntegerValue();
    }

    @Transactional(readOnly = true)
    public void requireEntitlement(OrganizationWorkspace workspace, String key) {
        if (!hasEntitlement(workspace, key)) throw new EntitlementDeniedException("Entitlement is required: " + key);
    }

    @Transactional(readOnly = true)
    public void requireIntegerLimit(OrganizationWorkspace workspace, String key, int requestedValue) {
        if (requestedValue < 0) throw new InvalidEntitlementValueException("Requested entitlement usage cannot be negative");
        int limit = getIntegerLimit(workspace, key);
        if (requestedValue > limit) throw new EntitlementDeniedException("Entitlement limit exceeded: " + key);
    }
    private boolean isActiveBoolean(PlanEntitlement value, String key) {
        return value.getDefinition().getStatus() == CatalogStatus.ACTIVE && value.getDefinition().getValueType() == EntitlementValueType.BOOLEAN
                && value.getDefinition().getKey().equals(key) && value.getIntegerValue() == null;
    }
    private boolean isActiveInteger(PlanEntitlement value, String key) {
        return value.getDefinition().getStatus() == CatalogStatus.ACTIVE && value.getDefinition().getValueType() == EntitlementValueType.INTEGER
                && value.getDefinition().getKey().equals(key);
    }

    private boolean isEffective(OrganizationPlanAssignment assignment) {
        return assignment.getStatus() == AssignmentStatus.ACTIVE && assignment.getProduct().getStatus() == ProductStatus.ACTIVE
                && assignment.getPlan().getStatus() == CatalogStatus.ACTIVE
                && (assignment.getPlan().getProduct() == null
                    ? enablesProduct(assignment.getPlan(), assignment.getProduct().getKey())
                    : assignment.getPlan().getProduct().getId().equals(assignment.getProduct().getId()));
    }
    public boolean enablesProduct(Plan plan, String productKey) {
        return values.findForPlan(plan.getId()).stream().anyMatch(value ->
                isActiveBoolean(value, productKey + ".enabled") && Boolean.TRUE.equals(value.getBooleanValue()));
    }
    public void requireWorkspaceCapacity(String productKey, long requestedCount) {
        var context = contexts.get().orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
        var all = assignments.findForOrganization(context.organizationId());
        var commercial = all.stream().filter(a -> a.getStatus() == AssignmentStatus.ACTIVE && a.getPlan().getProduct() == null).toList();
        if (commercial.isEmpty()) {
            if (all.stream().anyMatch(a -> a.getPlan().getProduct() == null)) throw new EntitlementDeniedException("An active commercial plan is required");
            return; // Preserve legacy provisioning semantics.
        }
        Plan plan = commercial.getFirst().getPlan();
        if (commercial.stream().anyMatch(a -> !a.getPlan().getId().equals(plan.getId())) || plan.getStatus() != CatalogStatus.ACTIVE || !enablesProduct(plan, productKey))
            throw new EntitlementDeniedException("Product is not enabled by the organization plan");
        var limit = values.findForPlan(plan.getId()).stream().filter(v -> isActiveInteger(v, "platform.workspace_limit")).findFirst()
                .orElseThrow(() -> new EntitlementDeniedException("Workspace limit is unavailable"));
        if (limit.getIntegerValue() == null || limit.getIntegerValue() < 0 || limit.getBooleanValue() != null || requestedCount > limit.getIntegerValue())
            throw new EntitlementDeniedException("Workspace limit exceeded");
    }
    private EffectiveEntitlementResponse response(OrganizationPlanAssignment assignment) {
        List<EffectiveEntitlementResponse.Value> entitlements = values.findForPlan(assignment.getPlan().getId()).stream()
                .filter(value -> isSafeEffectiveValue(value, assignment.getPlan().getProduct() == null ? null : assignment.getProduct().getKey()))
                .map(value -> new EffectiveEntitlementResponse.Value(value.getDefinition().getKey(), value.getDefinition().getValueType().name(), value.getBooleanValue(), value.getIntegerValue())).toList();
        return new EffectiveEntitlementResponse(assignment.getProduct().getKey(), assignment.getPlan().getKey(), assignment.getPlan().getDisplayName(), entitlements);
    }
    private boolean isSafeEffectiveValue(PlanEntitlement value, String productKey) {
        try { if (productKey == null) EntitlementKey.requireValid(value.getDefinition().getKey()); else EntitlementKey.requireForProduct(value.getDefinition().getKey(), productKey); }
        catch (InvalidEntitlementValueException ex) { return false; }
        if (value.getDefinition().getStatus() != CatalogStatus.ACTIVE) return false;
        return switch (value.getDefinition().getValueType()) {
            case BOOLEAN -> value.getBooleanValue() != null && value.getIntegerValue() == null;
            case INTEGER -> value.getIntegerValue() != null && value.getIntegerValue() >= 0 && value.getBooleanValue() == null;
        };
    }
}
