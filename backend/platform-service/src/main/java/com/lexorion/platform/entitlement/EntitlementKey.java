package com.lexorion.platform.entitlement;

import com.lexorion.platform.entitlement.exception.InvalidEntitlementValueException;
import java.util.regex.Pattern;

/** Published product capability key: lowercase product namespace followed by dot-separated semantic segments. */
public final class EntitlementKey {
    private static final Pattern FORMAT = Pattern.compile("^[a-z][a-z0-9]*(?:\\.[a-z][a-z0-9_]*)+$");
    private EntitlementKey() { }

    public static String requireValid(String key) {
        if (key == null || !FORMAT.matcher(key).matches()) {
            throw new InvalidEntitlementValueException("Invalid entitlement key");
        }
        return key;
    }

    public static String requireForProduct(String key, String productKey) {
        requireValid(key);
        if (!key.startsWith(productKey + ".")) {
            throw new InvalidEntitlementValueException("Entitlement key does not belong to workspace product");
        }
        return key;
    }
}
