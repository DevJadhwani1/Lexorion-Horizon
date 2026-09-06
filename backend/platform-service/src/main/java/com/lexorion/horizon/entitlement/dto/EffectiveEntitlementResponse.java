package com.lexorion.horizon.entitlement.dto;
import java.util.List;
public record EffectiveEntitlementResponse(String productKey, String planKey, String planName, List<Value> entitlements) {
    public record Value(String key, String valueType, Boolean booleanValue, Integer integerValue) { }
}
