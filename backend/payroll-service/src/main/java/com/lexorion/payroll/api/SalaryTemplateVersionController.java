package com.lexorion.payroll.api;

import static com.lexorion.payroll.api.SalaryTemplateVersionDtos.*;
import com.lexorion.payroll.service.SalaryTemplateVersionService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payroll/salary-templates/{templateKey}/versions")
@PreAuthorize("hasRole('ADMIN')")
public class SalaryTemplateVersionController {
    private final SalaryTemplateVersionService service;
    public SalaryTemplateVersionController(SalaryTemplateVersionService service) { this.service = service; }
    @GetMapping public List<VersionResponse> list(@PathVariable String templateKey) { return service.list(templateKey); }
    @PostMapping public ResponseEntity<VersionResponse> create(@PathVariable String templateKey, @Valid @RequestBody CreateVersion request) { return ResponseEntity.status(HttpStatus.CREATED).body(service.create(templateKey, request)); }
    @GetMapping("/{versionNumber}") public VersionResponse get(@PathVariable String templateKey, @PathVariable int versionNumber) { return service.get(templateKey, versionNumber); }
    @PatchMapping("/{versionNumber}") public VersionResponse update(@PathVariable String templateKey, @PathVariable int versionNumber, @Valid @RequestBody UpdateVersion request) { return service.update(templateKey, versionNumber, request); }
    @PostMapping("/{versionNumber}/activate") public VersionResponse activate(@PathVariable String templateKey, @PathVariable int versionNumber) { return service.activate(templateKey, versionNumber); }
    @PostMapping("/{versionNumber}/deactivate") public VersionResponse deactivate(@PathVariable String templateKey, @PathVariable int versionNumber) { return service.deactivate(templateKey, versionNumber); }
}
