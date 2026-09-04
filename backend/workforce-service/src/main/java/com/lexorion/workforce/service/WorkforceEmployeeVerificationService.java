package com.lexorion.workforce.service;

import com.lexorion.workforce.api.WorkforceException;
import com.lexorion.workforce.domain.EmploymentStatus;
import com.lexorion.workforce.repository.EmployeeRepository;
import com.lexorion.workforce.tenant.TrustedWorkforceContext;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkforceEmployeeVerificationService {
    private final WorkspaceScope scope;
    private final EmployeeRepository employees;

    public WorkforceEmployeeVerificationService(WorkspaceScope scope, EmployeeRepository employees) {
        this.scope = scope;
        this.employees = employees;
    }

    @Transactional(readOnly = true)
    public VerificationResponse verify(String rawEmployeeCode, UUID claimedOrganizationId,
            UUID claimedWorkspaceId, UUID claimedUserId, String claimedRole) {
        TrustedWorkforceContext context = scope.context();
        if (!context.organizationId().equals(claimedOrganizationId)
                || !context.workspaceId().equals(claimedWorkspaceId)
                || !context.userId().equals(claimedUserId)
                || !context.role().name().equals(claimedRole)) {
            throw new WorkforceException(403, "Trusted Payroll and Workforce authority contexts do not match");
        }
        String employeeCode = normalize(rawEmployeeCode);
        if (!employeeCode.matches("^[A-Z0-9][A-Z0-9._-]{0,63}$")) {
            throw new WorkforceException(400, "Invalid employee code");
        }
        return employees.findByWorkspaceIdAndCode(context.workspaceId(), employeeCode)
                .map(employee -> new VerificationResponse(employee.getCode(), true, employee.getStatus()))
                .orElseThrow(() -> new WorkforceException(404, "Employee not found in authorized Workforce workspace"));
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    public record VerificationResponse(String employeeCode, boolean exists, EmploymentStatus employmentStatus) { }
}
