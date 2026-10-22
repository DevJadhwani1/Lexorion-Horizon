package com.lexorion.finance.service;

import static com.lexorion.finance.api.TemplateDtos.*;

import com.lexorion.finance.api.FinanceException;
import com.lexorion.finance.api.TemplateConfig;
import com.lexorion.finance.domain.FinanceWorkspace;
import com.lexorion.finance.domain.InvoiceTemplate;
import com.lexorion.finance.domain.TemplateLayout;
import com.lexorion.finance.domain.TemplateStatus;
import com.lexorion.finance.repository.InvoiceTemplateRepository;
import java.text.Normalizer;
import java.time.Clock;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/** Each workspace designs its own bill formats. The first template becomes the default; exactly one default stays active. */
@Service
public class InvoiceTemplateService {
    private final FinanceWorkspaceScope scope;
    private final InvoiceTemplateRepository templates;
    private final InvoiceNumbering numbering;
    private final JsonMapper json;
    private final Clock clock;

    public InvoiceTemplateService(FinanceWorkspaceScope scope, InvoiceTemplateRepository templates, InvoiceNumbering numbering,
            JsonMapper json, Clock clock) {
        this.scope = scope;
        this.templates = templates;
        this.numbering = numbering;
        this.json = json;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<TemplateResponse> list() {
        return templates.findByWorkspaceIdOrderByNameAsc(scope.context().workspaceId()).stream().map(t -> response(t, null)).toList();
    }

    @Transactional(readOnly = true)
    public TemplateResponse get(String key) {
        return response(find(key), null);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public TemplateResponse create(CreateTemplate request) {
        FinanceWorkspace workspace = scope.locked();
        TemplateConfig config = validated(request.config());
        String key = request.templateKey() != null && !request.templateKey().isBlank() ? request.templateKey() : uniqueKey(workspace.getId(), request.name());
        if (templates.existsByWorkspaceIdAndTemplateKey(workspace.getId(), key)) throw new FinanceException(409, "A template with this key already exists");
        Optional<InvoiceTemplate> currentDefault = defaultTemplate(workspace.getId());
        InvoiceTemplate template = new InvoiceTemplate();
        template.setWorkspace(workspace);
        template.setTemplateKey(key);
        template.setName(request.name().trim());
        template.setLayout(request.layout() == null ? TemplateLayout.MODERN : request.layout());
        template.setConfig(write(config));
        template.setStatus(TemplateStatus.ACTIVE);
        boolean makeDefault = currentDefault.isEmpty() || Boolean.TRUE.equals(request.makeDefault());
        if (makeDefault) currentDefault.ifPresent(previous -> { previous.setDefaultTemplate(false); templates.saveAndFlush(previous); });
        template.setDefaultTemplate(makeDefault);
        return response(templates.saveAndFlush(template), workspace);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public TemplateResponse update(String key, UpdateTemplate request) {
        FinanceWorkspace workspace = scope.locked();
        InvoiceTemplate template = find(key);
        if (request.name() != null) {
            if (request.name().isBlank()) throw new FinanceException(400, "Template name is required");
            template.setName(request.name().trim());
        }
        if (request.layout() != null) template.setLayout(request.layout());
        if (request.config() != null) template.setConfig(write(validated(request.config())));
        if (request.status() != null) {
            if (request.status() == TemplateStatus.ARCHIVED && template.isDefaultTemplate())
                throw new FinanceException(409, "Choose another default template before archiving this one");
            template.setStatus(request.status());
        }
        return response(templates.saveAndFlush(template), workspace);
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public TemplateResponse makeDefault(String key) {
        FinanceWorkspace workspace = scope.locked();
        InvoiceTemplate template = find(key);
        if (template.getStatus() != TemplateStatus.ACTIVE) throw new FinanceException(409, "Archived templates cannot be the default");
        defaultTemplate(workspace.getId()).filter(previous -> !previous.getId().equals(template.getId())).ifPresent(previous -> {
            previous.setDefaultTemplate(false);
            templates.saveAndFlush(previous);
        });
        template.setDefaultTemplate(true);
        return response(templates.saveAndFlush(template), workspace);
    }

    @Transactional(readOnly = true)
    public NextNumber nextNumber(String key, LocalDate date) {
        InvoiceTemplate template = find(key);
        return new NextNumber(numbering.preview(template.getWorkspace(), read(template.getConfig()).numbering(), date == null ? LocalDate.now(clock) : date));
    }

    /** The active template an invoice uses: the requested one, else the workspace default, else none (the standard format). */
    InvoiceTemplate forInvoice(UUID workspaceId, String requestedKey) {
        if (requestedKey == null || requestedKey.isBlank()) return defaultTemplate(workspaceId).orElse(null);
        InvoiceTemplate template = templates.findByWorkspaceIdAndTemplateKey(workspaceId, requestedKey.trim())
                .orElseThrow(() -> new FinanceException(404, "Invoice template not found"));
        if (template.getStatus() != TemplateStatus.ACTIVE) throw new FinanceException(409, "The invoice template is archived");
        return template;
    }

    RenderTemplate render(InvoiceTemplate template) {
        return template == null ? new RenderTemplate(null, "Standard", TemplateLayout.MODERN, TemplateConfig.standard())
                : new RenderTemplate(template.getTemplateKey(), template.getName(), template.getLayout(), read(template.getConfig()));
    }

    String freeze(RenderTemplate template) {
        return json.writeValueAsString(template);
    }

    RenderTemplate thaw(String snapshot) {
        RenderTemplate frozen = json.readValue(snapshot, RenderTemplate.class);
        return new RenderTemplate(frozen.templateKey(), frozen.name(), frozen.layout(), frozen.config().normalized());
    }

    TemplateConfig read(String config) {
        return json.readValue(config, TemplateConfig.class).normalized();
    }

    private TemplateConfig validated(TemplateConfig config) {
        TemplateConfig normalized = config.normalized();
        InvoiceNumbering.validate(normalized.numbering());
        Set<String> keys = new HashSet<>();
        for (TemplateConfig.CustomField field : normalized.customFields())
            if (!keys.add(field.key())) throw new FinanceException(400, "Custom field keys must be unique: " + field.key());
        return normalized;
    }

    private String write(TemplateConfig config) {
        return json.writeValueAsString(config);
    }

    private Optional<InvoiceTemplate> defaultTemplate(UUID workspaceId) {
        return templates.findFirstByWorkspaceIdAndDefaultTemplateTrueAndStatus(workspaceId, TemplateStatus.ACTIVE);
    }

    private InvoiceTemplate find(String key) {
        return templates.findByWorkspaceIdAndTemplateKey(scope.context().workspaceId(), key == null ? "" : key.trim())
                .orElseThrow(() -> new FinanceException(404, "Invoice template not found"));
    }

    private TemplateResponse response(InvoiceTemplate t, FinanceWorkspace workspace) {
        TemplateConfig config = read(t.getConfig());
        String next = numbering.preview(workspace == null ? t.getWorkspace() : workspace, config.numbering(), LocalDate.now(clock));
        return new TemplateResponse(t.getTemplateKey(), t.getName(), t.getLayout(), t.isDefaultTemplate(), t.getStatus(), config, next,
                t.getCreatedAt(), t.getUpdatedAt());
    }

    private String uniqueKey(UUID workspaceId, String name) {
        String base = Normalizer.normalize(name == null ? "" : name, Normalizer.Form.NFKD).toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        if (base.length() > 56) base = base.substring(0, 56).replaceAll("-+$", "");
        if (base.isEmpty()) base = "template";
        String key = base;
        for (int suffix = 2; templates.existsByWorkspaceIdAndTemplateKey(workspaceId, key); suffix++) key = base + "-" + suffix;
        return key;
    }
}
