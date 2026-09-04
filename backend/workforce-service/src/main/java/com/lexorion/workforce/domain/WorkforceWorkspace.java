package com.lexorion.workforce.domain;
import com.lexorion.workforce.config.Auditable;import jakarta.persistence.*;import java.util.UUID;import lombok.*;
@Entity @Table(name="workforce_workspaces",uniqueConstraints=@UniqueConstraint(name="uk_workforce_workspace_key",columnNames="workspace_key")) @Getter @Setter @NoArgsConstructor
public class WorkforceWorkspace extends Auditable {@Id @Column(nullable=false,updatable=false) private UUID id;@Column(name="workspace_key",nullable=false,length=63,updatable=false) private String key;}
