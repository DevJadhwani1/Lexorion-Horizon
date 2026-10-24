package com.lexorion.finance.api;

import static com.lexorion.finance.api.BillingDtos.PaymentResponse;
import static com.lexorion.finance.api.ReceiptDtos.AllocateReceipt;
import static com.lexorion.finance.api.ReceiptDtos.CreateReceipt;

import com.lexorion.finance.service.ReceiptService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Client receipts that can be allocated across invoices, left unallocated, or reversed. */
@RestController
@RequestMapping("/api/finance/receipts")
@PreAuthorize("hasRole('ADMIN')")
public class ReceiptController {
    private final ReceiptService service;

    public ReceiptController(ReceiptService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<PaymentResponse> create(@Valid @RequestBody CreateReceipt request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request, idempotencyKey));
    }

    @PostMapping("/{receiptNumber}/allocations")
    public ResponseEntity<PaymentResponse> allocate(@PathVariable String receiptNumber, @Valid @RequestBody AllocateReceipt request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.allocate(receiptNumber, request, idempotencyKey));
    }

    @PostMapping("/{receiptNumber}/allocations/{allocationId}/reverse")
    public PaymentResponse reverse(@PathVariable String receiptNumber, @PathVariable UUID allocationId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        return service.reverse(receiptNumber, allocationId, idempotencyKey);
    }
}
