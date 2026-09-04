package com.lexorion.payroll.tenant;public interface PayrollAuthorityClient{TrustedPayrollContext validate(String workspaceKey,String bearerToken,String host,String organizationSlug);}
