package com.lexorion.payroll.service;

import static com.lexorion.payroll.api.SalaryTemplateVersionDtos.*;
import com.lexorion.payroll.api.PayrollException;
import com.lexorion.payroll.domain.*;
import com.lexorion.payroll.repository.*;
import java.math.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SalaryTemplateVersionService {
    private final PayrollWorkspaceScope scope;
    private final SalaryTemplateRepository templates;
    private final SalaryTemplateVersionRepository versions;
    private final ComponentDefinitionRepository definitions;

    public SalaryTemplateVersionService(PayrollWorkspaceScope scope, SalaryTemplateRepository templates,
            SalaryTemplateVersionRepository versions, ComponentDefinitionRepository definitions) {
        this.scope = scope; this.templates = templates; this.versions = versions; this.definitions = definitions;
    }

    @Transactional(readOnly = true)
    public List<VersionResponse> list(String rawTemplate) {
        return versions.findByTemplateIdOrderByVersionNumberDesc(template(rawTemplate).getId()).stream().map(this::response).toList();
    }

    @Transactional(readOnly = true)
    public VersionResponse get(String rawTemplate, int number) {
        return response(find(rawTemplate, number));
    }

    @Transactional
    public VersionResponse create(String rawTemplate, CreateVersion request) {
        SalaryTemplate template = template(rawTemplate);
        int next = versions.findFirstByTemplateIdOrderByVersionNumberDesc(template.getId()).map(v -> v.getVersionNumber() + 1).orElse(1);
        validateDates(request.effectiveFrom(), request.effectiveTo());
        validateNoOverlap(template, request.effectiveFrom(), request.effectiveTo(), null);
        SalaryTemplateVersion version = new SalaryTemplateVersion();
        version.setTemplate(template); version.setVersionNumber(next); version.setCurrency(currency(request.currency()));
        version.setPayFrequency(request.payFrequency()); version.setStatus(request.status());
        version.setEffectiveFrom(request.effectiveFrom()); version.setEffectiveTo(request.effectiveTo());
        replace(version, request.components());
        return response(versions.saveAndFlush(version));
    }

    @Transactional
    public VersionResponse update(String rawTemplate, int number, UpdateVersion request) {
        SalaryTemplateVersion version = find(rawTemplate, number);
        if (version.getStatus() != SalaryTemplateVersionStatus.DRAFT) throw new PayrollException(409, "Only draft template versions can be changed");
        LocalDate from = request.effectiveFrom() == null ? version.getEffectiveFrom() : request.effectiveFrom();
        LocalDate to = request.effectiveTo() == null ? version.getEffectiveTo() : request.effectiveTo();
        validateDates(from, to); validateNoOverlap(version.getTemplate(), from, to, version.getId());
        if (request.currency() != null) version.setCurrency(currency(request.currency()));
        if (request.payFrequency() != null) version.setPayFrequency(request.payFrequency());
        version.setEffectiveFrom(from); version.setEffectiveTo(to);
        if (request.status() != null) version.setStatus(request.status());
        if (request.components() != null) replace(version, request.components());
        return response(versions.saveAndFlush(version));
    }

    @Transactional
    public VersionResponse activate(String rawTemplate, int number) {
        SalaryTemplateVersion version = find(rawTemplate, number);
        validateNoOverlap(version.getTemplate(), version.getEffectiveFrom(), version.getEffectiveTo(), version.getId());
        version.setStatus(SalaryTemplateVersionStatus.ACTIVE);
        return response(versions.saveAndFlush(version));
    }

    @Transactional
    public VersionResponse deactivate(String rawTemplate, int number) {
        SalaryTemplateVersion version = find(rawTemplate, number);
        version.setStatus(SalaryTemplateVersionStatus.INACTIVE);
        return response(versions.saveAndFlush(version));
    }

    private SalaryTemplate template(String raw) {
        return templates.findByWorkspaceIdAndTemplateKey(scope.context().workspaceId(), SalaryTemplateService.key(raw))
                .orElseThrow(() -> new PayrollException(404, "Salary template not found"));
    }
    private SalaryTemplateVersion find(String raw, int number) {
        if (number < 1) throw new PayrollException(400, "Invalid template version");
        return versions.findByTemplateIdAndVersionNumber(template(raw).getId(), number)
                .orElseThrow(() -> new PayrollException(404, "Salary template version not found"));
    }
    private void replace(SalaryTemplateVersion version, List<VersionComponentRequest> items) {
        if (items == null || items.isEmpty()) throw new PayrollException(400, "Template version requires components");
            version.getComponents().clear();
            versions.flush();
            Set<String> seen = new HashSet<>(); int sequence = 0;
        for (VersionComponentRequest item : items) {
            String key = ComponentDefinitionService.key(item.componentKey());
            if (!seen.add(key)) throw new PayrollException(400, "Duplicate template component");
            ComponentDefinition definition = definitions.findByWorkspaceIdAndComponentKey(scope.context().workspaceId(), key)
                    .orElseThrow(() -> new PayrollException(404, "Compensation component not found"));
            if (definition.getStatus() != ComponentStatus.ACTIVE) throw new PayrollException(409, "Inactive compensation component cannot be configured");
            validateValue(definition, item.value());
            SalaryTemplateVersionComponent component = new SalaryTemplateVersionComponent();
            component.setVersion(version); component.setDefinition(definition); component.setComponentKey(key);
            component.setValue(item.value().setScale(4, RoundingMode.UNNECESSARY)); component.setPercentageBasis(item.percentageBasis());
            component.setDisplaySequence(item.displaySequence() == null ? sequence : item.displaySequence());
            version.getComponents().add(component); sequence++;
        }
    }
    private void validateValue(ComponentDefinition definition, BigDecimal value) {
        if (value == null || value.signum() < 0 || value.scale() > 4 || value.precision() - value.scale() > 15)
            throw new PayrollException(400, "Component value is invalid");
        if (definition.getAmountType() == AmountType.PERCENTAGE && value.compareTo(new BigDecimal("100")) > 0)
            throw new PayrollException(400, "Percentage cannot exceed 100");
        if (definition.getAmountType() == AmountType.FIXED_AMOUNT && value.scale() > 4)
            throw new PayrollException(400, "Fixed amount is invalid");
    }
    private void validateDates(LocalDate from, LocalDate to) { if (from == null || (to != null && to.isBefore(from))) throw new PayrollException(400, "Invalid effective dates"); }
    private void validateNoOverlap(SalaryTemplate template, LocalDate from, LocalDate to, UUID excluded) {
        for (SalaryTemplateVersion other : versions.findByTemplateIdOrderByVersionNumberDesc(template.getId())) {
            if (excluded != null && excluded.equals(other.getId())) continue;
            if (overlaps(from, to, other.getEffectiveFrom(), other.getEffectiveTo())) throw new PayrollException(409, "Template version overlaps an existing version");
        }
    }
    private boolean overlaps(LocalDate aFrom, LocalDate aTo, LocalDate bFrom, LocalDate bTo) { return (aTo == null || !aTo.isBefore(bFrom)) && (bTo == null || !bTo.isBefore(aFrom)); }
    private String currency(String raw) { return PayrollEmployeeService.currency(raw); }
    private VersionResponse response(SalaryTemplateVersion version) {
        List<VersionComponentResponse> components = version.getComponents().stream()
                .sorted(Comparator.comparingInt(SalaryTemplateVersionComponent::getDisplaySequence).thenComparing(SalaryTemplateVersionComponent::getComponentKey))
                .map(c -> { ComponentDefinition d = c.getDefinition(); return new VersionComponentResponse(c.getComponentKey(), d.getDisplayName(), d.getCategory(), d.getAmountType(), d.getOccurrenceType(), d.getTaxability(), c.getValue(), c.getPercentageBasis(), c.getDisplaySequence()); }).toList();
        return new VersionResponse(version.getTemplate().getTemplateKey(), version.getVersionNumber(), version.getCurrency(), version.getPayFrequency(), version.getStatus(), version.getEffectiveFrom(), version.getEffectiveTo(), components, version.getCreatedAt(), version.getUpdatedAt());
    }
}
