package com.lexorion.finance.service;

import com.lexorion.finance.api.FinanceException;
import com.lexorion.finance.domain.FinanceWorkspace;
import com.lexorion.finance.domain.IdempotencyKey;
import com.lexorion.finance.repository.IdempotencyKeyRepository;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;

/** Stores the resource created by a successful write so the same Idempotency-Key returns that resource. */
@Service
public class Idempotency {
    private final IdempotencyKeyRepository keys;

    public Idempotency(IdempotencyKeyRepository keys) {
        this.keys = keys;
    }

    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String key = raw.trim();
        if (key.length() > 80) throw new FinanceException(400, "Idempotency-Key must be 80 characters or fewer");
        return key;
    }

    public Optional<UUID> find(UUID workspaceId, String operation, String key) {
        if (key == null) return Optional.empty();
        return keys.findByWorkspaceIdAndOperationAndKey(workspaceId, operation, key).map(IdempotencyKey::getResourceId);
    }

    public void remember(FinanceWorkspace workspace, String operation, String key, UUID resourceId) {
        if (key == null) return;
        IdempotencyKey row = new IdempotencyKey();
        row.setWorkspace(workspace);
        row.setOperation(operation);
        row.setKey(key);
        row.setResourceId(resourceId);
        keys.save(row);
    }
}
