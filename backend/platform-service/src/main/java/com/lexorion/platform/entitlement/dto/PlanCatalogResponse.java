package com.lexorion.platform.entitlement.dto;
import com.lexorion.platform.entitlement.entity.Plan;
public record PlanCatalogResponse(String key, String displayName, String description, String productKey, String status) {
    public static PlanCatalogResponse from(Plan plan) { return new PlanCatalogResponse(plan.getKey(), plan.getDisplayName(), plan.getDescription(), plan.getProduct().getKey(), plan.getStatus().name()); }
}
