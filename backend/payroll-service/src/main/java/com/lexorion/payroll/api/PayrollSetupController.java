package com.lexorion.payroll.api;

import static com.lexorion.payroll.api.PayrollSetupDtos.*;

import com.lexorion.payroll.service.*;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Payroll setup for one employee. Sensitive identifiers travel only in request bodies and are returned masked. */
@RestController
@RequestMapping("/api/payroll/employees/{employeeCode}")
@PreAuthorize("hasRole('ADMIN')")
public class PayrollSetupController {
    private final PayrollSetupService setup;
    private final StatutoryEstimateService estimates;
    public PayrollSetupController(PayrollSetupService setup, StatutoryEstimateService estimates) { this.setup = setup; this.estimates = estimates; }

    @GetMapping("/setup")
    public ResponseEntity<SetupResponse> get(@PathVariable String employeeCode) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(setup.get(employeeCode));
    }

    @PutMapping("/statutory-profile")
    public ResponseEntity<SetupResponse> update(@PathVariable String employeeCode, @Valid @RequestBody UpdateStatutoryProfile request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(setup.update(employeeCode, request));
    }

    @PostMapping("/statutory-estimate")
    public EstimateResponse estimate(@PathVariable String employeeCode, @Valid @RequestBody EstimateRequest request) {
        return estimates.estimate(employeeCode, request);
    }
}
