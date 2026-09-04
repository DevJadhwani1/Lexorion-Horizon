package com.lexorion.payroll.workforce;

import com.lexorion.payroll.tenant.TrustedPayrollContext;

public interface WorkforceEmployeeVerifier {
    Verification verify(String employeeCode, TrustedPayrollContext payrollContext);

    record Verification(String employeeCode, boolean exists, WorkforceEmploymentStatus employmentStatus) {
        public Verification {
            if (employeeCode == null || employeeCode.isBlank()) {
                throw new IllegalArgumentException("Employee code is required");
            }
            if (exists && employmentStatus == null) {
                throw new IllegalArgumentException("Existing Workforce employee requires an employment status");
            }
            if (!exists && employmentStatus != null) {
                throw new IllegalArgumentException("Missing Workforce employee cannot have an employment status");
            }
        }
    }
}
