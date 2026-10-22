package com.lexorion.finance.service;

import static com.lexorion.finance.api.BillingDtos.*;

import com.lexorion.finance.api.FinanceException;
import com.lexorion.finance.domain.BillingClient;
import com.lexorion.finance.domain.ClientStatus;
import com.lexorion.finance.domain.FinanceWorkspace;
import com.lexorion.finance.repository.BillingClientRepository;
import com.lexorion.finance.repository.InvoiceRepository;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BillingClientService {
    static final int DEFAULT_PAYMENT_TERMS = 30;
    private final FinanceWorkspaceScope scope;
    private final BillingClientRepository clients;
    private final InvoiceRepository invoices;

    public BillingClientService(FinanceWorkspaceScope scope, BillingClientRepository clients, InvoiceRepository invoices) {
        this.scope = scope;
        this.clients = clients;
        this.invoices = invoices;
    }

    @Transactional(readOnly = true)
    public List<ClientResponse> list() {
        UUID workspaceId = scope.context().workspaceId();
        Map<UUID, Object[]> open = new HashMap<>();
        for (Object[] row : invoices.outstandingByClient(workspaceId)) open.put((UUID) row[0], row);
        return clients.findByWorkspaceIdOrderByDisplayNameAsc(workspaceId).stream().map(c -> {
            Object[] row = open.get(c.getId());
            return row == null ? ClientResponse.from(c, BigDecimal.ZERO, 0)
                    : ClientResponse.from(c, (BigDecimal) row[1], ((Number) row[2]).longValue());
        }).toList();
    }

    @Transactional(readOnly = true)
    public ClientResponse get(String clientKey) {
        BillingClient client = find(clientKey);
        for (Object[] row : invoices.outstandingByClient(client.getWorkspace().getId()))
            if (client.getId().equals(row[0])) return ClientResponse.from(client, (BigDecimal) row[1], ((Number) row[2]).longValue());
        return ClientResponse.from(client, BigDecimal.ZERO, 0);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ClientResponse create(CreateClient request) {
        FinanceWorkspace workspace = scope.locked();
        String key;
        if (request.clientKey() != null && !request.clientKey().isBlank()) {
            key = request.clientKey();
            if (clients.existsByWorkspaceIdAndClientKey(workspace.getId(), key)) throw new FinanceException(409, "A client with this key already exists");
        } else {
            key = uniqueKey(workspace.getId(), request.displayName());
        }
        BillingClient client = new BillingClient();
        client.setWorkspace(workspace);
        client.setClientKey(key);
        client.setDisplayName(request.displayName().trim());
        client.setEmail(blankToNull(request.email()));
        client.setPhone(blankToNull(request.phone()));
        client.setBillingAddress(blankToNull(request.billingAddress()));
        client.setTaxId(blankToNull(request.taxId()));
        client.setCurrency(currency(request.currency()));
        client.setPaymentTermsDays(request.paymentTermsDays() == null ? DEFAULT_PAYMENT_TERMS : request.paymentTermsDays());
        client.setStatus(ClientStatus.ACTIVE);
        return ClientResponse.from(clients.saveAndFlush(client), BigDecimal.ZERO, 0);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ClientResponse update(String clientKey, UpdateClient request) {
        scope.locked();
        BillingClient client = find(clientKey);
        if (request.displayName() != null) {
            if (request.displayName().isBlank()) throw new FinanceException(400, "Client name is required");
            client.setDisplayName(request.displayName().trim());
        }
        if (request.email() != null) client.setEmail(blankToNull(request.email()));
        if (request.phone() != null) client.setPhone(blankToNull(request.phone()));
        if (request.billingAddress() != null) client.setBillingAddress(blankToNull(request.billingAddress()));
        if (request.taxId() != null) client.setTaxId(blankToNull(request.taxId()));
        if (request.currency() != null) client.setCurrency(currency(request.currency()));
        if (request.paymentTermsDays() != null) client.setPaymentTermsDays(request.paymentTermsDays());
        if (request.status() != null) client.setStatus(request.status());
        clients.saveAndFlush(client);
        return get(clientKey);
    }

    BillingClient find(String clientKey) {
        return clients.findByWorkspaceIdAndClientKey(scope.context().workspaceId(), clientKey == null ? "" : clientKey.trim())
                .orElseThrow(() -> new FinanceException(404, "Client not found"));
    }

    private String uniqueKey(UUID workspaceId, String name) {
        String base = Normalizer.normalize(name == null ? "" : name, Normalizer.Form.NFKD).toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        if (base.length() > 56) base = base.substring(0, 56).replaceAll("-+$", "");
        if (base.isEmpty()) base = "client";
        String key = base;
        for (int suffix = 2; clients.existsByWorkspaceIdAndClientKey(workspaceId, key); suffix++) key = base + "-" + suffix;
        return key;
    }

    static String currency(String value) {
        String v = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (!v.matches("^[A-Z]{3}$")) throw new FinanceException(400, "Currency must be a three-letter ISO code");
        return v;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
