package com.lexorion.horizon.entitlement.dto;
import com.lexorion.horizon.entitlement.entity.Plan;
public record PlanCatalogResponse(String key, String displayName, String description, String productKey, String status,
        java.util.List<EffectiveEntitlementResponse.Value> entitlements) {
    public static PlanCatalogResponse from(Plan plan, java.util.List<EffectiveEntitlementResponse.Value> values) { return new PlanCatalogResponse(plan.getKey(), plan.getDisplayName(), plan.getDescription(), plan.getProduct() == null ? null : plan.getProduct().getKey(), plan.getStatus().name(), values); }
}
