package com.lexorion.workforce.config;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
@MappedSuperclass @Getter
public abstract class Auditable {
    @Column(nullable=false,updatable=false) private Instant createdAt;
    @Column(nullable=false) private Instant updatedAt;
    @PrePersist void create(){ createdAt=updatedAt=Instant.now(); }
    @PreUpdate void update(){ updatedAt=Instant.now(); }
}
