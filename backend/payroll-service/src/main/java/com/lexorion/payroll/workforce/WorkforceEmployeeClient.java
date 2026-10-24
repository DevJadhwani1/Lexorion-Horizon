package com.lexorion.payroll.workforce;

import com.lexorion.payroll.tenant.TrustedPayrollContext;

public interface WorkforceEmployeeClient {
    WorkforceEmployeeVerifier.Verification verify(String employeeCode, TrustedPayrollContext context);

    /** The workforce employee mapped to the signed-in user. Never a code supplied by the client. */
    String currentEmployeeCode(TrustedPayrollContext context);
}
