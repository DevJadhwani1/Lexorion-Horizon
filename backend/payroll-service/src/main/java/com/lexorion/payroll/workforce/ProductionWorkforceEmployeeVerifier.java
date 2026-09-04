package com.lexorion.payroll.workforce;

import com.lexorion.payroll.tenant.TrustedPayrollContext;
import org.springframework.stereotype.Component;

@Component
public class ProductionWorkforceEmployeeVerifier implements WorkforceEmployeeVerifier {
    private final WorkforceEmployeeClient client;

    public ProductionWorkforceEmployeeVerifier(WorkforceEmployeeClient client) { this.client = client; }

    @Override
    public Verification verify(String employeeCode, TrustedPayrollContext payrollContext) {
        return client.verify(employeeCode, payrollContext);
    }
}
