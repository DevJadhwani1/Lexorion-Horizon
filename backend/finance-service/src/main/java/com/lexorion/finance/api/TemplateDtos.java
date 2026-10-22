package com.lexorion.finance.api;

import com.lexorion.finance.domain.TemplateLayout;
import com.lexorion.finance.domain.TemplateStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public final class TemplateDtos {
    private TemplateDtos() { }

    public record CreateTemplate(
            @Pattern(regexp = "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$", message = "must use lowercase letters, numbers and hyphens") String templateKey,
            @NotBlank @Size(max = 120) String name,
            TemplateLayout layout,
            @NotNull @Valid TemplateConfig config,
            Boolean makeDefault) { }

    public record UpdateTemplate(
            @Size(min = 1, max = 120) String name,
            TemplateLayout layout,
            @Valid TemplateConfig config,
            TemplateStatus status) { }

    public record TemplateResponse(String templateKey, String name, TemplateLayout layout, boolean isDefault,
            TemplateStatus status, TemplateConfig config, String nextNumber, Instant createdAt, Instant updatedAt) { }

    /** What a renderer needs to draw a bill: the live template for drafts, the frozen copy for issued invoices. */
    public record RenderTemplate(String templateKey, String name, TemplateLayout layout, TemplateConfig config) { }

    public record NextNumber(String number) { }
}
