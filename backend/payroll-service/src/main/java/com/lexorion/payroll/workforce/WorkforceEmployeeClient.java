package com.lexorion.payroll.workforce;

import com.lexorion.payroll.tenant.TrustedPayrollContext;

public interface WorkforceEmployeeClient {
    WorkforceEmployeeVerifier.Verification verify(String employeeCode, TrustedPayrollContext context);
}
