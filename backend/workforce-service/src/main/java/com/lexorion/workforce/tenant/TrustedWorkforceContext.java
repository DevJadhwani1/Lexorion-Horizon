package com.lexorion.workforce.tenant;
import java.util.UUID;
public record TrustedWorkforceContext(UUID workspaceId, String workspaceKey, String organizationSlug, WorkforceRole role, UUID userId, UUID organizationId,
        java.util.List<UUID> organizationWorkspaceIds, int employeeLimit) {
 private static final UUID ZERO=new UUID(0,0);
 public TrustedWorkforceContext {
  organizationWorkspaceIds=organizationWorkspaceIds==null?java.util.List.of():java.util.List.copyOf(organizationWorkspaceIds);
  if(workspaceId==null||workspaceId.equals(ZERO)||userId==null||userId.equals(ZERO)||organizationId==null||organizationId.equals(ZERO)||workspaceKey==null||workspaceKey.isBlank()||organizationSlug==null||organizationSlug.isBlank()||role==null||employeeLimit<1||organizationWorkspaceIds.isEmpty()||!organizationWorkspaceIds.contains(workspaceId)||organizationWorkspaceIds.stream().anyMatch(id->id==null||id.equals(ZERO)))throw new IllegalArgumentException("Complete trusted Platform authority context is required");
 }
 public TrustedWorkforceContext(UUID workspaceId,String workspaceKey,String organizationSlug,WorkforceRole role,UUID userId,UUID organizationId){this(workspaceId,workspaceKey,organizationSlug,role,userId,organizationId,java.util.List.of(workspaceId),Integer.MAX_VALUE);}
}
