package com.lexorion.payroll.entitlement;
import com.lexorion.payroll.tenant.TrustedPayrollContext;
public interface PayrollProcessingEntitlementGate { void requireProcessing(TrustedPayrollContext context); }
