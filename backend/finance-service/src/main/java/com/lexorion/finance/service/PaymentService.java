package com.lexorion.finance.service;

import static com.lexorion.finance.api.BillingDtos.*;

import com.lexorion.finance.api.FinanceException;
import com.lexorion.finance.repository.PaymentRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentService {
    private final FinanceWorkspaceScope scope;
    private final PaymentRepository payments;

    public PaymentService(FinanceWorkspaceScope scope, PaymentRepository payments) {
        this.scope = scope;
        this.payments = payments;
    }

    /** Received payments, newest first. */
    @Transactional(readOnly = true)
    public PageResponse<PaymentResponse> list(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw new FinanceException(400, "Page must be zero or more and size between 1 and 100");
        var result = payments.findByWorkspaceId(scope.context().workspaceId(), PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "paymentDate").and(Sort.by(Sort.Direction.DESC, "receiptNumber"))));
        return new PageResponse<>(result.getContent().stream().map(PaymentResponse::from).toList(), page, size,
                result.getTotalElements(), result.getTotalPages(), "paymentDate", "desc");
    }
}
