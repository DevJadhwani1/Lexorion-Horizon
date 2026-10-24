package com.lexorion.payroll.api;

import static com.lexorion.payroll.api.PayrollHistoryDtos.PayslipResponse;
import com.lexorion.payroll.service.PayrollHistoryService;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Finalized payslips for the signed-in user. The employee code is resolved on the server. */
@RestController
@RequestMapping("/api/payroll/me/payslips")
@PreAuthorize("hasAnyRole('ADMIN','MANAGER','EMPLOYEE')")
public class OwnPayslipController {
    private final PayrollHistoryService service;
    public OwnPayslipController(PayrollHistoryService service) { this.service = service; }
    @GetMapping public List<PayslipResponse> list() { return service.ownPayslips(); }
    @GetMapping("/{payRunKey}") public PayslipResponse one(@PathVariable String payRunKey) { return service.ownPayslip(payRunKey); }
}
