package com.lexorion.horizon.workspace.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Null;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Set;
import java.util.Locale;
import java.util.UUID;

public record CreateWorkspaceRequest(
        @NotBlank @Pattern(regexp = "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$") String key,
        @NotBlank @Size(max = 150) String displayName,
        @Pattern(regexp = "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$") String productKey,
        @Null(message = "organizationId is not accepted; tenant context determines ownership") UUID organizationId,
        @Null(message = "productId is not accepted; use productKey") UUID productId,
        @Size(max = 20) Set<@NotBlank @Pattern(regexp = "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$") String> productKeys) {
    public CreateWorkspaceRequest {
        key = normalize(key);
        productKey = normalize(productKey);
        productKeys = productKeys == null || productKeys.isEmpty() ? null : Set.copyOf(productKeys);
    }
    private static String normalize(String value) { return value == null ? null : value.trim().toLowerCase(Locale.ROOT); }
}
