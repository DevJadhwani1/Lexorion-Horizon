package com.lexorion.core.audit;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="audit_events",indexes={@Index(name="idx_audit_events_occurred_at",columnList="occurred_at"),@Index(name="idx_audit_events_actor",columnList="actor_user_id")})
public class AuditEvent {
 @Id private UUID id;
 @Column(name="occurred_at",nullable=false,updatable=false) private Instant occurredAt;
 @Column(name="actor_user_id",updatable=false) private UUID actorUserId;
 @Column(name="organization_id",updatable=false) private UUID organizationId;
 @Column(name="workspace_id",updatable=false) private UUID workspaceId;
 @Column(nullable=false,updatable=false,length=63) private String service;
 @Column(nullable=false,updatable=false,length=100) private String operation;
 @Column(name="resource_type",nullable=false,updatable=false,length=100) private String resourceType;
 @Column(name="resource_id",updatable=false,length=150) private String resourceId;
 @Column(nullable=false,updatable=false,length=32) private String result;
 @Column(name="correlation_id",updatable=false,length=64) private String correlationId;
 @Column(updatable=false,columnDefinition="text") private String metadata;
 protected AuditEvent(){}
 public AuditEvent(UUID actorUserId,UUID organizationId,UUID workspaceId,String operation,String resourceType,String resourceId,String result,String correlationId,String metadata){this.id=UUID.randomUUID();this.occurredAt=Instant.now();this.actorUserId=actorUserId;this.organizationId=organizationId;this.workspaceId=workspaceId;this.service="PLATFORM-SERVICE";this.operation=operation;this.resourceType=resourceType;this.resourceId=resourceId;this.result=result;this.correlationId=correlationId;this.metadata=metadata;}
}
