package com.lexorion.platform.entitlement.service;

import com.lexorion.platform.entitlement.dto.EffectiveEntitlementResponse;
import com.lexorion.platform.entitlement.EntitlementKey;
import com.lexorion.platform.entitlement.exception.EntitlementDeniedException;
import com.lexorion.platform.entitlement.exception.InvalidEntitlementValueException;
import com.lexorion.platform.entitlement.entity.*;
import com.lexorion.platform.entitlement.repository.*;
import com.lexorion.platform.product.entity.*;
import com.lexorion.platform.tenantaccess.context.*;
import com.lexorion.platform.workspace.entity.OrganizationWorkspace;
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
        TenantAccessContext context = contexts.get().orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
        OrganizationPlanAssignment assignment = assignments.findForOrganizationAndProduct(context.organizationId(), workspace.getProduct().getId())
                .orElseThrow(() -> new AccessDeniedException("An active plan is required for workspace access"));
        if (!isEffective(assignment)) throw new AccessDeniedException("An active plan is required for workspace access");
        return assignment;
    }

    @Transactional(readOnly = true)
    public boolean hasEntitlement(OrganizationWorkspace workspace, String key) {
        EntitlementKey.requireForProduct(key, workspace.getProduct().getKey());
        Plan plan = requireEffectivePlan(workspace).getPlan();
        return values.findForPlan(plan.getId()).stream().anyMatch(value -> isActiveBoolean(value, key)
                && Boolean.TRUE.equals(value.getBooleanValue()));
    }

    @Transactional(readOnly = true)
    public int getIntegerLimit(OrganizationWorkspace workspace, String key) {
        EntitlementKey.requireForProduct(key, workspace.getProduct().getKey());
        Plan plan = requireEffectivePlan(workspace).getPlan();
        PlanEntitlement value = values.findForPlan(plan.getId()).stream().filter(candidate -> isActiveInteger(candidate, key))
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
                && assignment.getPlan().getProduct().getId().equals(assignment.getProduct().getId());
    }
    private EffectiveEntitlementResponse response(OrganizationPlanAssignment assignment) {
        List<EffectiveEntitlementResponse.Value> entitlements = values.findForPlan(assignment.getPlan().getId()).stream()
                .filter(value -> isSafeEffectiveValue(value, assignment.getProduct().getKey()))
                .map(value -> new EffectiveEntitlementResponse.Value(value.getDefinition().getKey(), value.getDefinition().getValueType().name(), value.getBooleanValue(), value.getIntegerValue())).toList();
        return new EffectiveEntitlementResponse(assignment.getProduct().getKey(), assignment.getPlan().getKey(), assignment.getPlan().getDisplayName(), entitlements);
    }
    private boolean isSafeEffectiveValue(PlanEntitlement value, String productKey) {
        try { EntitlementKey.requireForProduct(value.getDefinition().getKey(), productKey); }
        catch (InvalidEntitlementValueException ex) { return false; }
        if (value.getDefinition().getStatus() != CatalogStatus.ACTIVE) return false;
        return switch (value.getDefinition().getValueType()) {
            case BOOLEAN -> value.getBooleanValue() != null && value.getIntegerValue() == null;
            case INTEGER -> value.getIntegerValue() != null && value.getIntegerValue() >= 0 && value.getBooleanValue() == null;
        };
    }
}
