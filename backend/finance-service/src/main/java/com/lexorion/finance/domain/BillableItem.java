package com.lexorion.finance.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

/** A service or product the workspace bills for, identified by its reference code. */
@Entity
@Table(name = "finance_items", uniqueConstraints = @UniqueConstraint(name = "uk_finance_item_workspace_code", columnNames = {"workspace_id", "item_code"}))
@Getter
@Setter
@NoArgsConstructor
public class BillableItem extends Auditable {
    @Id
    @UuidGenerator
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false, updatable = false)
    private FinanceWorkspace workspace;

    @Column(name = "item_code", nullable = false, updatable = false, length = 32)
    private String itemCode;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(length = 300)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ItemKind kind = ItemKind.SERVICE;

    @Column(length = 60)
    private String category;

    @Column(name = "hsn_sac", length = 8)
    private String hsnSac;

    @Column(length = 16)
    private String unit;

    @Column(name = "unit_price", precision = 19, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "tax_rate", precision = 7, scale = 4)
    private BigDecimal taxRate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ClientStatus status = ClientStatus.ACTIVE;
}
