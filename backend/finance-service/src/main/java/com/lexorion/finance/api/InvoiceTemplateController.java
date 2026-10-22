package com.lexorion.finance.api;

import static com.lexorion.finance.api.TemplateDtos.*;

import com.lexorion.finance.service.InvoiceTemplateService;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/finance/templates")
@PreAuthorize("hasRole('ADMIN')")
public class InvoiceTemplateController {
    private final InvoiceTemplateService service;

    public InvoiceTemplateController(InvoiceTemplateService service) {
        this.service = service;
    }

    @GetMapping
    public List<TemplateResponse> list() {
        return service.list();
    }

    @PostMapping
    public ResponseEntity<TemplateResponse> create(@Valid @RequestBody CreateTemplate request) {
        TemplateResponse created = service.create(request);
        return ResponseEntity.created(URI.create("/api/finance/templates/" + created.templateKey())).body(created);
    }

    @GetMapping("/{templateKey}")
    public TemplateResponse get(@PathVariable String templateKey) {
        return service.get(templateKey);
    }

    @PutMapping("/{templateKey}")
    public TemplateResponse update(@PathVariable String templateKey, @Valid @RequestBody UpdateTemplate request) {
        return service.update(templateKey, request);
    }

    @PostMapping("/{templateKey}/default")
    public TemplateResponse makeDefault(@PathVariable String templateKey) {
        return service.makeDefault(templateKey);
    }

    /** The number an invoice issued on {@code date} would receive with this template. Nothing is reserved. */
    @GetMapping("/{templateKey}/next-number")
    public NextNumber nextNumber(@PathVariable String templateKey, @RequestParam(required = false) LocalDate date) {
        return service.nextNumber(templateKey, date);
    }
}
