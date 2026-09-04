package com.lexorion.workforce.tenant;
import java.util.UUID;
public record TrustedWorkforceContext(UUID workspaceId, String workspaceKey, String organizationSlug, WorkforceRole role, UUID userId, UUID organizationId) {
 private static final UUID ZERO=new UUID(0,0);
 public TrustedWorkforceContext {
  if(workspaceId==null||workspaceId.equals(ZERO)||userId==null||userId.equals(ZERO)||organizationId==null||organizationId.equals(ZERO)||workspaceKey==null||workspaceKey.isBlank()||organizationSlug==null||organizationSlug.isBlank()||role==null)throw new IllegalArgumentException("Complete trusted Platform authority context is required");
 }
}
