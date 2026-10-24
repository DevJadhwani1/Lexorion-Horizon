package com.lexorion.finance.service;

import static com.lexorion.finance.api.BillingDtos.*;

import com.lexorion.finance.api.FinanceException;
import com.lexorion.finance.domain.Invoice;
import com.lexorion.finance.domain.Payment;
import com.lexorion.finance.repository.AllocationRepository;
import com.lexorion.finance.repository.PaymentRepository;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentService {
    private final FinanceWorkspaceScope scope;
    private final PaymentRepository payments;
    private final AllocationRepository allocations;

    public PaymentService(FinanceWorkspaceScope scope, PaymentRepository payments, AllocationRepository allocations) {
        this.scope = scope;
        this.payments = payments;
        this.allocations = allocations;
    }

    /** Received payments, newest first. */
    @Transactional(readOnly = true)
    public PageResponse<PaymentResponse> list(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw new FinanceException(400, "Page must be zero or more and size between 1 and 100");
        var result = payments.findByWorkspaceId(scope.context().workspaceId(), PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "paymentDate").and(Sort.by(Sort.Direction.DESC, "receiptNumber"))));
        Map<UUID, BigDecimal> allocated = new HashMap<>();
        if (!result.isEmpty()) {
            for (Object[] row : allocations.activeTotals(result.getContent().stream().map(Payment::getId).toList()))
                allocated.put((UUID) row[0], (BigDecimal) row[1]);
        }
        return new PageResponse<>(result.getContent().stream().map(payment -> {
            BigDecimal applied = allocated.getOrDefault(payment.getId(), BigDecimal.ZERO);
            var active = allocations.findByReceiptIdAndReversedAtIsNull(payment.getId());
            Invoice shown = active.size() == 1 ? active.get(0).getInvoice() : payment.getInvoice();
            if (active.size() > 1) shown = null;
            return PaymentResponse.of(payment, shown, payment.getAmount(), applied, null);
        }).toList(), page, size, result.getTotalElements(), result.getTotalPages(), "paymentDate", "desc");
    }
}
