package com.lexorion.workforce.api;

import com.lexorion.workforce.service.WorkforceEmployeeVerificationService;
import com.lexorion.workforce.service.WorkforceEmployeeVerificationService.VerificationResponse;
import io.swagger.v3.oas.annotations.Operation;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class InternalWorkforceVerificationController {
    private final WorkforceEmployeeVerificationService verification;

    public InternalWorkforceVerificationController(WorkforceEmployeeVerificationService verification) {
        this.verification = verification;
    }

    @GetMapping("/internal/workforce/employees/{employeeCode}/verification")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN')")
    @Operation(summary = "[INTERNAL] Verify a workspace-scoped Workforce employee for Payroll",
            description = "Internal service boundary. Revalidates forwarded user authority with Platform and returns only employeeCode, existence, and Workforce employment status.")
    public VerificationResponse verify(@PathVariable String employeeCode,
            @RequestHeader("X-Lexorion-Trusted-Organization-Id") UUID organizationId,
            @RequestHeader("X-Lexorion-Trusted-Workspace-Id") UUID workspaceId,
            @RequestHeader("X-Lexorion-Trusted-User-Id") UUID userId,
            @RequestHeader("X-Lexorion-Trusted-Role") String role) {
        return verification.verify(employeeCode, organizationId, workspaceId, userId, role);
    }
}
