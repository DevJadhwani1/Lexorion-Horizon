package com.lexorion.finance.api;

import static com.lexorion.finance.api.BillingDtos.*;

import com.lexorion.finance.domain.InvoiceStatus;
import com.lexorion.finance.service.InvoiceService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/finance/invoices")
@PreAuthorize("hasRole('ADMIN')")
public class InvoiceController {
    private final InvoiceService service;

    public InvoiceController(InvoiceService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<InvoiceSummary> list(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, @RequestParam(defaultValue = "createdAt") String sort,
            @RequestParam(defaultValue = "desc") String direction, @RequestParam(required = false) InvoiceStatus status,
            @RequestParam(required = false) String clientKey, @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "false") boolean overdue) {
        return service.list(page, size, sort, direction, status, clientKey, search, overdue);
    }

    @PostMapping
    public ResponseEntity<InvoiceResponse> create(@Valid @RequestBody InvoiceRequest request) {
        InvoiceResponse created = service.create(request);
        return ResponseEntity.created(URI.create("/api/finance/invoices/" + created.reference())).body(created);
    }

    @GetMapping("/{reference}")
    public InvoiceResponse get(@PathVariable String reference) {
        return service.get(reference);
    }

    @PutMapping("/{reference}")
    public InvoiceResponse update(@PathVariable String reference, @Valid @RequestBody InvoiceRequest request) {
        return service.update(reference, request);
    }

    @PostMapping("/{reference}/issue")
    public InvoiceResponse issue(@PathVariable String reference, @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        return service.issue(reference, idempotencyKey);
    }

    @PostMapping("/{reference}/void")
    public InvoiceResponse voidInvoice(@PathVariable String reference, @Valid @RequestBody VoidInvoice request) {
        return service.voidInvoice(reference, request);
    }

    @GetMapping("/{reference}/payments")
    public List<PaymentResponse> payments(@PathVariable String reference) {
        return service.payments(reference);
    }

    @PostMapping("/{reference}/payments")
    public ResponseEntity<PaymentResponse> recordPayment(@PathVariable String reference, @Valid @RequestBody RecordPayment request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.recordPayment(reference, request, idempotencyKey));
    }
}
