package com.lexorion.finance.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** Remembers a successful financial write so a retry returns the original record instead of creating another. */
@Entity
@EntityListeners(AuditingEntityListener.class)
@Table(name = "finance_idempotency_keys",
        uniqueConstraints = @UniqueConstraint(name = "uk_finance_idempotency", columnNames = {"workspace_id", "operation", "idempotency_key"}))
@Getter
@Setter
@NoArgsConstructor
public class IdempotencyKey {
    @Id
    @UuidGenerator
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false, updatable = false)
    private FinanceWorkspace workspace;

    @Column(nullable = false, updatable = false, length = 40)
    private String operation;

    @Column(name = "idempotency_key", nullable = false, updatable = false, length = 80)
    private String key;

    @Column(name = "resource_id", nullable = false, updatable = false)
    private UUID resourceId;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
