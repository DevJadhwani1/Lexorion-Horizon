package com.lexorion.finance.api;

import static com.lexorion.finance.api.BillingDtos.*;

import com.lexorion.finance.service.BillingSummaryService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/finance/summary")
@PreAuthorize("hasRole('ADMIN')")
public class BillingSummaryController {
    private final BillingSummaryService service;

    public BillingSummaryController(BillingSummaryService service) {
        this.service = service;
    }

    @GetMapping
    public BillingSummary summary() {
        return service.summary();
    }
}
