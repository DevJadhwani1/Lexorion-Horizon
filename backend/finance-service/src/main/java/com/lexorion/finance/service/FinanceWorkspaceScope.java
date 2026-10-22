package com.lexorion.finance.service;

import com.lexorion.finance.domain.FinanceWorkspace;
import com.lexorion.finance.repository.FinanceWorkspaceRepository;
import com.lexorion.finance.tenant.TrustedFinanceContext;
import com.lexorion.finance.tenant.TrustedFinanceContextHolder;
import org.springframework.stereotype.Component;

/** Resolves the trusted workspace for the current request, creating its local record on first write. */
@Component
public class FinanceWorkspaceScope {
    private final TrustedFinanceContextHolder contexts;
    private final FinanceWorkspaceRepository workspaces;

    public FinanceWorkspaceScope(TrustedFinanceContextHolder contexts, FinanceWorkspaceRepository workspaces) {
        this.contexts = contexts;
        this.workspaces = workspaces;
    }

    public TrustedFinanceContext context() {
        return contexts.require();
    }

    /** The workspace row, locked for the rest of the transaction. Serializes document numbering. */
    public FinanceWorkspace locked() {
        TrustedFinanceContext c = context();
        FinanceWorkspace value = workspaces.findById(c.workspaceId()).orElseGet(() -> {
            FinanceWorkspace w = new FinanceWorkspace();
            w.setId(c.workspaceId());
            w.setKey(c.workspaceKey());
            return workspaces.saveAndFlush(w);
        });
        if (!value.getKey().equals(c.workspaceKey())) throw new IllegalStateException("Trusted workspace identity mismatch");
        return workspaces.findByIdForUpdate(value.getId()).orElseThrow();
    }
}
