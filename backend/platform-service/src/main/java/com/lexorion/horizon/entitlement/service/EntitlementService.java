package com.lexorion.horizon.entitlement.service;

import com.lexorion.horizon.entitlement.EntitlementKey;
import com.lexorion.horizon.entitlement.dto.EffectiveEntitlementResponse;
import com.lexorion.horizon.entitlement.entity.*;
import com.lexorion.horizon.entitlement.exception.EntitlementDeniedException;
import com.lexorion.horizon.entitlement.exception.InvalidEntitlementValueException;
import com.lexorion.horizon.entitlement.repository.OrganizationPlanAssignmentRepository;
import com.lexorion.horizon.entitlement.repository.PlanEntitlementRepository;
import com.lexorion.horizon.tenantaccess.context.TenantAccessContext;
import com.lexorion.horizon.tenantaccess.context.TenantAccessContextHolder;
import com.lexorion.horizon.workspace.entity.OrganizationWorkspace;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EntitlementService {
    private final TenantAccessContextHolder contexts;
    private final OrganizationPlanAssignmentRepository assignments;
    private final PlanEntitlementRepository values;

    public EntitlementService(TenantAccessContextHolder contexts, OrganizationPlanAssignmentRepository assignments,
            PlanEntitlementRepository values) {
        this.contexts = contexts;
        this.assignments = assignments;
        this.values = values;
    }

    @Transactional(readOnly = true)
    public List<EffectiveEntitlementResponse> effectiveForCurrentOrganization() {
        TenantAccessContext context = contexts.get().orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
        OrganizationPlanAssignment assignment = assignments.findForOrganization(context.organizationId()).orElse(null);
        return assignment == null || !isEffective(assignment) ? List.of() : List.of(response(assignment));
    }

    @Transactional(readOnly = true)
    public EffectiveEntitlementResponse effectiveForOrganization(java.util.UUID organizationId) {
        return assignments.findForOrganization(organizationId).filter(this::isEffective).map(this::response).orElse(null);
    }

    @Transactional(readOnly = true)
    public OrganizationPlanAssignment requireEffectivePlan(OrganizationWorkspace workspace) {
        return requireEffectivePlan(workspace, workspace.getProduct().getKey());
    }

    @Transactional(readOnly = true)
    public OrganizationPlanAssignment requireEffectivePlan(OrganizationWorkspace workspace, String productKey) {
        TenantAccessContext context = contexts.get().orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
        if (!workspace.getOrganization().getId().equals(context.organizationId())) throw new AccessDeniedException("Workspace is not accessible");
        OrganizationPlanAssignment assignment = assignments.findForOrganization(context.organizationId())
                .filter(this::isEffective).orElseThrow(() -> new AccessDeniedException("An active organization plan is required"));
        if ("workforce".equals(productKey) || "payroll".equals(productKey))
            requireBoolean(assignment.getPlan(), productKey + ".enabled");
        workspace.availableProducts().stream()
                .filter(p -> p.getKey().equals(productKey) && p.getStatus() == com.lexorion.horizon.product.entity.ProductStatus.ACTIVE)
                .findFirst().orElseThrow(() -> new AccessDeniedException("Product is not attached or active"));
        return assignment;
    }

    @Transactional(readOnly = true)
    public boolean hasEntitlement(OrganizationWorkspace workspace, String key) {
        EntitlementKey.requireValid(key);
        TenantAccessContext context = contexts.get().orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
        if (!workspace.getOrganization().getId().equals(context.organizationId())) throw new AccessDeniedException("Workspace is not accessible");
        String productKey = key.substring(0, key.indexOf('.'));
        if ("finance".equals(productKey) && workspace.availableProducts().stream()
                .noneMatch(product -> product.getKey().equals(productKey) && product.getStatus() == com.lexorion.horizon.product.entity.ProductStatus.ACTIVE)) return false;
        OrganizationPlanAssignment assignment = assignments.findForOrganization(context.organizationId())
                .filter(this::isEffective).orElse(null);
        return assignment != null && booleanValue(assignment.getPlan(), key);
    }

    @Transactional(readOnly = true)
    public int getIntegerLimit(OrganizationWorkspace workspace, String key) {
        EntitlementKey.requireValid(key);
        String configuredKey = key.equals("workforce.employee_limit") ? "platform.employee_limit" : key;
        String productKey = configuredKey.startsWith("platform.") ? "workforce" : key.substring(0, key.indexOf('.'));
        Plan plan = requireEffectivePlan(workspace, productKey).getPlan();
        PlanEntitlement value = values.findForPlan(plan.getId()).stream()
                .filter(candidate -> activeDefinition(candidate, configuredKey, EntitlementValueType.INTEGER))
                .findFirst().orElseThrow(() -> new EntitlementDeniedException("Integer entitlement is unavailable: " + key));
        if (value.getIntegerValue() == null || value.getIntegerValue() < 0 || value.getBooleanValue() != null)
            throw new InvalidEntitlementValueException("Invalid configured integer entitlement: " + key);
        return value.getIntegerValue();
    }

    @Transactional(readOnly = true)
    public int getOrganizationEmployeeLimit(java.util.UUID organizationId) {
        OrganizationPlanAssignment assignment = assignments.findForOrganization(organizationId)
                .filter(this::isEffective).orElseThrow(() -> new EntitlementDeniedException("An active organization plan is required"));
        requireBoolean(assignment.getPlan(), "workforce.enabled");
        return integerValue(assignment.getPlan(), "platform.employee_limit");
    }

    @Transactional(readOnly = true)
    public void requireEntitlement(OrganizationWorkspace workspace, String key) {
        if (!hasEntitlement(workspace, key)) throw new EntitlementDeniedException("Entitlement is required: " + key);
    }

    @Transactional(readOnly = true)
    public void requireWorkspaceCapacity(java.util.UUID organizationId, long requestedCount) {
        OrganizationPlanAssignment assignment = assignments.findForOrganization(organizationId)
                .filter(this::isEffective).orElseThrow(() -> new EntitlementDeniedException("An active organization plan is required"));
        Plan plan = assignment.getPlan();
        requireBoolean(plan, "workforce.enabled");
        requireBoolean(plan, "payroll.enabled");
        int limit = integerValue(plan, "platform.workspace_limit");
        if (requestedCount > limit) throw new EntitlementDeniedException("Workspace limit exceeded");
    }

    private boolean isEffective(OrganizationPlanAssignment assignment) {
        return assignment.getStatus() == AssignmentStatus.ACTIVE && assignment.getPlan().getProduct() == null
                && assignment.getPlan().getStatus() == CatalogStatus.ACTIVE
                && ("starter".equals(assignment.getPlan().getKey()) || "business".equals(assignment.getPlan().getKey()));
    }

    private boolean booleanValue(Plan plan, String key) {
        return values.findForPlan(plan.getId()).stream().anyMatch(value -> activeDefinition(value, key, EntitlementValueType.BOOLEAN)
                && Boolean.TRUE.equals(value.getBooleanValue()) && value.getIntegerValue() == null);
    }

    private void requireBoolean(Plan plan, String key) {
        if (!booleanValue(plan, key)) throw new EntitlementDeniedException("Entitlement is required: " + key);
    }

    private int integerValue(Plan plan, String key) {
        PlanEntitlement value = values.findForPlan(plan.getId()).stream()
                .filter(candidate -> activeDefinition(candidate, key, EntitlementValueType.INTEGER))
                .findFirst().orElseThrow(() -> new EntitlementDeniedException("Integer entitlement is unavailable: " + key));
        if (value.getIntegerValue() == null || value.getIntegerValue() < 0 || value.getBooleanValue() != null)
            throw new InvalidEntitlementValueException("Invalid configured integer entitlement: " + key);
        return value.getIntegerValue();
    }

    private boolean activeDefinition(PlanEntitlement value, String key, EntitlementValueType type) {
        return value.getDefinition().getStatus() == CatalogStatus.ACTIVE && value.getDefinition().getValueType() == type
                && value.getDefinition().getKey().equals(key);
    }

    private EffectiveEntitlementResponse response(OrganizationPlanAssignment assignment) {
        List<EffectiveEntitlementResponse.Value> entitlements = values.findForPlan(assignment.getPlan().getId()).stream()
                .filter(value -> value.getDefinition().getStatus() == CatalogStatus.ACTIVE)
                .filter(value -> switch (value.getDefinition().getValueType()) {
                    case BOOLEAN -> value.getBooleanValue() != null && value.getIntegerValue() == null;
                    case INTEGER -> value.getIntegerValue() != null && value.getIntegerValue() >= 0 && value.getBooleanValue() == null;
                })
                .map(value -> new EffectiveEntitlementResponse.Value(value.getDefinition().getKey(), value.getDefinition().getValueType().name(), value.getBooleanValue(), value.getIntegerValue()))
                .toList();
        return new EffectiveEntitlementResponse("organization", assignment.getPlan().getKey(), assignment.getPlan().getDisplayName(), entitlements);
    }
}
