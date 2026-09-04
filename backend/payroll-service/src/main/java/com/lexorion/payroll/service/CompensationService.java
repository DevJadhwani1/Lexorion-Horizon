package com.lexorion.payroll.service;

import static com.lexorion.payroll.api.CompensationDtos.*;
import com.lexorion.payroll.api.PayrollException;
import com.lexorion.payroll.domain.*;
import com.lexorion.payroll.repository.*;
import java.math.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class CompensationService {
    private final PayrollWorkspaceScope scope;
    private final PayrollEmployeeRepository employees;
    private final CompensationProfileRepository profiles;
    private final ComponentDefinitionRepository definitions;

    public CompensationService(PayrollWorkspaceScope scope, PayrollEmployeeRepository employees,
            CompensationProfileRepository profiles, ComponentDefinitionRepository definitions) {
        this.scope = scope;
        this.employees = employees;
        this.profiles = profiles;
        this.definitions = definitions;
    }

    @Transactional(readOnly = true)
    public List<ProfileResponse> list(String raw) {
        String code = employeeCode(raw);
        requireEmployee(code);
        return profiles.findByPayrollEmployeeWorkspaceIdAndPayrollEmployeeEmployeeCodeOrderByEffectiveFromAsc(
                scope.context().workspaceId(), code).stream().map(this::response).toList();
    }

    @Transactional(readOnly = true)
    public ProfileResponse get(String rawEmployeeCode, String rawProfileKey) {
        return response(profiles.findByPayrollEmployeeWorkspaceIdAndPayrollEmployeeEmployeeCodeAndProfileKey(
                scope.context().workspaceId(), employeeCode(rawEmployeeCode), profileKey(rawProfileKey))
                .orElseThrow(() -> new PayrollException(404, "Compensation profile not found")));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ProfileResponse create(String raw, CreateProfile request) {
        scope.locked();
        String code = employeeCode(raw);
        PayrollEmployee employee = employees.findScopedForUpdate(scope.context().workspaceId(), code)
                .orElseThrow(() -> new PayrollException(404, "Payroll employee not found"));
        String key = profileKey(request.profileKey());
        if (request.effectiveTo() != null && request.effectiveTo().isBefore(request.effectiveFrom())) {
            throw new PayrollException(400, "effectiveTo cannot precede effectiveFrom");
        }
        if (profiles.findByPayrollEmployeeWorkspaceIdAndPayrollEmployeeEmployeeCodeAndProfileKey(
                scope.context().workspaceId(), code, key).isPresent()) {
            throw new PayrollException(409, "Compensation profile key already exists");
        }
        if (profiles.countOverlaps(employee.getId(), request.effectiveFrom(), request.effectiveTo()) > 0) {
            throw new PayrollException(409, "Compensation profile overlaps an existing profile");
        }
        CompensationProfile profile = new CompensationProfile();
        profile.setPayrollEmployee(employee);
        profile.setProfileKey(key);
        profile.setCurrency(PayrollEmployeeService.currency(request.currency()));
        profile.setEffectiveFrom(request.effectiveFrom());
        profile.setEffectiveTo(request.effectiveTo());
        profile.setStatus(request.status());
        Set<String> seen = new HashSet<>();
        for (CreateAssignment item : request.components()) {
            String componentKey = ComponentDefinitionService.key(item.componentKey());
            if (!seen.add(componentKey)) throw new PayrollException(400, "Duplicate component assignment");
            ComponentDefinition definition = definitions.findByWorkspaceIdAndComponentKey(
                    scope.context().workspaceId(), componentKey)
                    .orElseThrow(() -> new PayrollException(404, "Compensation component not found"));
            if (definition.getStatus() != ComponentStatus.ACTIVE) {
                throw new PayrollException(409, "Inactive compensation component cannot be assigned");
            }
            validateValue(definition, item.value());
            ComponentAssignment assignment = new ComponentAssignment();
            assignment.setProfile(profile);
            assignment.setDefinition(definition);
            assignment.setValue(item.value().setScale(4, RoundingMode.UNNECESSARY));
            profile.getAssignments().add(assignment);
        }
        return response(profiles.saveAndFlush(profile));
    }

    private PayrollEmployee requireEmployee(String code) {
        return employees.findByWorkspaceIdAndEmployeeCode(scope.context().workspaceId(), code)
                .orElseThrow(() -> new PayrollException(404, "Payroll employee not found"));
    }

    private void validateValue(ComponentDefinition definition, BigDecimal value) {
        if (value == null || value.signum() < 0 || value.scale() > 4 || value.precision() - value.scale() > 15) {
            throw new PayrollException(400, "Component value is invalid");
        }
        if (definition.getAmountType() == AmountType.PERCENTAGE && value.compareTo(new BigDecimal("100")) > 0) {
            throw new PayrollException(400, "Percentage cannot exceed 100");
        }
    }

    private ProfileResponse response(CompensationProfile profile) {
        PayFrequency frequency = profile.getPayrollEmployee().getPayFrequency();
        List<AssignmentResponse> items = profile.getAssignments().stream()
                .sorted(Comparator.comparing(a -> a.getDefinition().getComponentKey()))
                .map(assignment -> {
                    ComponentDefinition definition = assignment.getDefinition();
                    return new AssignmentResponse(definition.getComponentKey(), definition.getDisplayName(),
                            definition.getCategory(), definition.getAmountType(), frequency,
                            definition.getOccurrenceType(), definition.getTaxability(), assignment.getValue());
                }).toList();
        return new ProfileResponse(profile.getPayrollEmployee().getEmployeeCode(), profile.getProfileKey(),
                profile.getCurrency(), profile.getEffectiveFrom(), profile.getEffectiveTo(), profile.getStatus(), items);
    }

    static String employeeCode(String raw) {
        String code = PayrollEmployeeService.code(raw);
        if (!code.matches("^[A-Z0-9][A-Z0-9._-]{0,63}$")) throw new PayrollException(400, "Invalid employee code");
        return code;
    }

    static String profileKey(String raw) {
        String key = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
        if (!key.matches("^[A-Z0-9][A-Z0-9._-]{0,63}$")) throw new PayrollException(400, "Invalid profile key");
        return key;
    }
}
