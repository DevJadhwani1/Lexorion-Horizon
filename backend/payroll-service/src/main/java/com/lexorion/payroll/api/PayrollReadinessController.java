package com.lexorion.payroll.api;

import com.lexorion.payroll.service.PayrollReadinessService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payroll/readiness")
@PreAuthorize("hasRole('ADMIN')")
public class PayrollReadinessController {
    private final PayrollReadinessService service;
    public PayrollReadinessController(PayrollReadinessService service) { this.service = service; }
    @GetMapping public PayrollReadinessService.Readiness get() { return service.get(); }
}
