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
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "finance_clients", uniqueConstraints = @UniqueConstraint(name = "uk_finance_client_workspace_key", columnNames = {"workspace_id", "client_key"}))
@Getter
@Setter
@NoArgsConstructor
public class BillingClient extends Auditable {
    @Id
    @UuidGenerator
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", nullable = false, updatable = false)
    private FinanceWorkspace workspace;

    @Column(name = "client_key", nullable = false, updatable = false, length = 63)
    private String clientKey;

    @Column(name = "display_name", nullable = false, length = 160)
    private String displayName;

    @Column(length = 254)
    private String email;

    @Column(length = 32)
    private String phone;

    @Column(name = "billing_address", length = 500)
    private String billingAddress;

    @Column(name = "tax_id", length = 32)
    private String taxId;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(name = "payment_terms_days", nullable = false)
    private int paymentTermsDays;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ClientStatus status = ClientStatus.ACTIVE;
}
