package com.lexorion.platform.entitlement.dto;
import com.lexorion.platform.entitlement.entity.EntitlementDefinition;
public record EntitlementCatalogResponse(String key, String displayName, String description, String valueType, String status) {
    public static EntitlementCatalogResponse from(EntitlementDefinition definition) { return new EntitlementCatalogResponse(definition.getKey(), definition.getDisplayName(), definition.getDescription(), definition.getValueType().name(), definition.getStatus().name()); }
}
