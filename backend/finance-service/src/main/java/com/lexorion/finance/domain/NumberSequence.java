package com.lexorion.finance.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

/** Next serial for one rendered number prefix, for example {@code OH/26-27/#}. Updated only under the workspace lock. */
@Entity
@Table(name = "finance_number_sequences", uniqueConstraints = @UniqueConstraint(name = "uk_finance_sequence_scope", columnNames = {"workspace_id", "scope"}))
@Getter
@Setter
@NoArgsConstructor
public class NumberSequence {
    @Id
    @UuidGenerator
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false, updatable = false)
    private FinanceWorkspace workspace;

    @Column(nullable = false, updatable = false, length = 64)
    private String scope;

    @Column(name = "next_value", nullable = false)
    private long nextValue = 1;
}
