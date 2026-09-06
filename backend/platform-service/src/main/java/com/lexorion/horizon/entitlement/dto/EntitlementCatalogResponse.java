package com.lexorion.horizon.entitlement.dto;
import com.lexorion.horizon.entitlement.entity.EntitlementDefinition;
public record EntitlementCatalogResponse(String key, String displayName, String description, String valueType, String status) {
    public static EntitlementCatalogResponse from(EntitlementDefinition definition) { return new EntitlementCatalogResponse(definition.getKey(), definition.getDisplayName(), definition.getDescription(), definition.getValueType().name(), definition.getStatus().name()); }
}
