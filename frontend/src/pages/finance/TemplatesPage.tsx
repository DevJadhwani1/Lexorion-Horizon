import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/types";
import { appPath } from "../../app/hostRouting";
import { useAuth } from "../../auth/AuthProvider";
import { Badge, StatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Dropdown } from "../../components/ui/Dropdown";
import { Empty, Notice, Page } from "../../components/ui/Page";
import {
  createTemplate, getTemplate, getTemplates, makeDefaultTemplate, renderNumber, updateTemplate,
  type CustomField, type InvoiceTemplate, type LabelledValue, type TemplateConfig, type TemplateLayout,
} from "../../features/finance/financeApi";
import { blankTemplateConfig, fieldKey, templatePresets } from "../../features/finance/templatePresets";
import { useOrganizationDefaults } from "../../features/organization/useOrganizationDefaults";
import { humanize } from "../../lib/format";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { Table } from "../admin/AdminPage";
import { InvoiceDocument, type DocumentData } from "./InvoiceDocument";
import { localToday } from "./FinancePage";

const templatesPath = (path = "") => appPath(`/app/finance/templates${path}`);
const message = (reason: unknown, fallback: string) => reason instanceof ApiError || reason instanceof Error ? reason.message : fallback;
const layouts: { value: TemplateLayout; label: string; note: string }[] = [
  { value: "MODERN", label: "Modern", note: "Colour bands" }, { value: "CLASSIC", label: "Classic", note: "Framed, formal" }, { value: "MINIMAL", label: "Minimal", note: "Light, airy" },
];
const monthOptions = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
  .map((label, index) => ({ value: String(index + 1), label }));

export function TemplatesPage({ section }: { section: "list" | "new" | "edit" }) {
  const key = useWorkspace().workspace?.key;
  if (section === "new") return <NewTemplate key={key} />;
  if (section === "edit") return <EditTemplate key={key} />;
  return <TemplateList key={key} />;
}

function TemplateList() {
  const [templates, setTemplates] = useState<InvoiceTemplate[] | null>(null);
  const [error, setError] = useState("");
  const load = () => { setError(""); getTemplates().then(setTemplates).catch((reason) => setError(message(reason, "Unable to load templates"))); };
  useEffect(load, []);
  const act = (action: Promise<unknown>) => { void action.then(load).catch((reason) => setError(message(reason, "Unable to update the template"))); };
  return <Page title="Invoice templates" description="Design how your bills look: branding, company and bank details, numbering, tax and the fields your industry needs."
    actions={<Link className="button primary" to={templatesPath("/new")}>New template</Link>}>
    {error && <Notice>{error}</Notice>}
    {!templates && !error && <p>Loading templates…</p>}
    {templates && (templates.length === 0 ? <Empty>No templates yet. Invoices use the standard format until you <Link to={templatesPath("/new")}>create a template</Link>.</Empty> :
      <Table headers={["Template", "Layout", "Next number", "Invoice fields", "Status", ""]}>
        {templates.map((template) => <tr key={template.templateKey}>
          <td><Link to={templatesPath(`/${template.templateKey}`)}><strong>{template.name}</strong></Link>{template.isDefault && <> <Badge label="Default" variant="success" /></>}</td>
          <td>{humanize(template.layout)}</td>
          <td><code>{template.nextNumber}</code></td>
          <td>{template.config.customFields.map((field) => field.label).join(", ") || "—"}</td>
          <td><StatusBadge status={template.status} /></td>
          <td className="row-actions">
            <Link to={templatesPath(`/${template.templateKey}`)}>Edit</Link>
            {!template.isDefault && template.status === "ACTIVE" && <button type="button" className="link-button" onClick={() => act(makeDefaultTemplate(template.templateKey))}>Make default</button>}
            {!template.isDefault && <button type="button" className="link-button" onClick={() => act(updateTemplate(template.templateKey, { status: template.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" }))}>{template.status === "ACTIVE" ? "Archive" : "Restore"}</button>}
          </td>
        </tr>)}
      </Table>)}
  </Page>;
}

function NewTemplate() {
  const [params, setParams] = useSearchParams();
  const preset = templatePresets.find((item) => item.key === params.get("preset"));
  if (!preset) return <Page title="New invoice template" description="Start from your industry. Every field, label and section can be changed afterwards.">
    <div className="preset-grid">
      {templatePresets.map((item) => <button key={item.key} type="button" onClick={() => setParams({ preset: item.key })}>
        <strong>{item.name}</strong><span>{item.description}</span>
      </button>)}
    </div>
  </Page>;
  return <Page title="New invoice template" description={`Starting from ${preset.name}. The preview updates as you type.`}>
    <TemplateEditor initialName={`${preset.name} invoice`} initialLayout={preset.layout} initialConfig={preset.apply(blankTemplateConfig())} />
  </Page>;
}

function EditTemplate() {
  const { templateKey = "" } = useParams();
  const [template, setTemplate] = useState<InvoiceTemplate | null>(null), [error, setError] = useState("");
  useEffect(() => { getTemplate(templateKey).then(setTemplate).catch((reason) => setError(message(reason, "Unable to load the template"))); }, [templateKey]);
  if (error) return <Page title="Invoice template"><Notice>{error}</Notice></Page>;
  if (!template) return <Page title="Invoice template"><p>Loading template…</p></Page>;
  return <Page title={template.name} description="Changes apply to drafts and future invoices. Issued invoices keep the format they were issued with.">
    <TemplateEditor key={template.updatedAt} template={template} initialName={template.name} initialLayout={template.layout} initialConfig={template.config} onSaved={setTemplate} />
  </Page>;
}

/** Sample bill for the live preview, filled with the template's own fields. */
function sampleDocument(config: TemplateConfig, number: string): DocumentData {
  const sample: Record<string, string> = {};
  for (const field of config.customFields) sample[field.key] = field.type === "DATE" ? "2026-04-10" : field.type === "NUMBER" ? "160" : `Sample ${field.label.toLowerCase()}`;
  const rate = config.tax.mode === "NONE" ? 0 : 18;
  const tax = 180000 * rate / 100;
  const gstSplit = config.tax.mode === "GST" && Boolean(config.seller.region);
  return {
    number, status: "ISSUED", currency: "INR", issueDate: "2026-05-30", dueDate: "2026-06-29", placeOfSupply: config.seller.region || "Maharashtra",
    billTo: { name: "Mastek Limited", contactName: "Ramya Chandran · Accounts Payable", address: "A-7, Millennium Business Park, Mahape\nNavi Mumbai 400710", email: "ap@mastek.example", phone: null, taxId: "27AAACM9908Q2ZP", region: "Maharashtra" },
    customFields: sample,
    lines: [{ lineNumber: 1, itemCode: "REC-001", description: "Professional fee", quantity: 1, unitPrice: 180000, taxRate: rate, subtotal: 180000, taxAmount: tax, total: 180000 + tax }],
    subtotal: 180000, total: 180000 + tax, amountPaid: 0, balanceDue: 180000 + tax,
    taxBreakdown: tax === 0 ? [] : config.tax.mode !== "GST" ? [{ label: config.tax.label, amount: tax }] : gstSplit ? [{ label: "CGST", amount: tax / 2 }, { label: "SGST", amount: tax / 2 }] : [{ label: "IGST", amount: tax }],
    notes: config.defaultNotes || null,
  };
}

function readImage(file: File, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) { reject(new Error("Use a PNG, JPEG, WebP or SVG image.")); return; }
    if (file.size > maxBytes) { reject(new Error(`Images must be under ${Math.round(maxBytes / 1024)} KB.`)); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
}

function TemplateEditor({ template, initialName, initialLayout, initialConfig, onSaved }: {
  template?: InvoiceTemplate; initialName: string; initialLayout: TemplateLayout; initialConfig: TemplateConfig; onSaved?(template: InvoiceTemplate): void;
}) {
  const navigate = useNavigate();
  const organizationName = useAuth().organization?.organizationName;
  const defaults = useOrganizationDefaults();
  const [name, setName] = useState(initialName), [layout, setLayout] = useState(initialLayout);
  const [config, setConfig] = useState<TemplateConfig>(() => ({ ...blankTemplateConfig(), ...initialConfig }));
  const [makeDefault, setMakeDefault] = useState(false);
  // Saved fields keep their keys when renamed: invoices store values under them.
  const [savedKeys] = useState(() => new Set(template ? initialConfig.customFields.map((field) => field.key) : []));
  const [error, setError] = useState(""), [saved, setSaved] = useState(""), [busy, setBusy] = useState(false);
  const section = <K extends keyof TemplateConfig>(key: K, change: Partial<TemplateConfig[K]>) => setConfig((current) => ({ ...current, [key]: { ...(current[key] as object), ...change } }));
  const set = <K extends keyof TemplateConfig>(key: K, value: TemplateConfig[K]) => setConfig((current) => ({ ...current, [key]: value }));
  const example = renderNumber(config.numbering, localToday(), 1);
  const patternChanged = template && template.config.numbering.pattern === config.numbering.pattern && template.config.numbering.padding === config.numbering.padding
    && template.config.numbering.fiscalYearStartMonth === config.numbering.fiscalYearStartMonth ? template.nextNumber : null;
  const image = (apply: (value: string) => void, maxBytes: number) => (file: File | undefined) => {
    if (!file) return;
    readImage(file, maxBytes).then(apply).catch((reason) => setError(message(reason, "The image could not be used")));
  };
  const save = () => {
    setBusy(true); setError(""); setSaved("");
    const clean: TemplateConfig = {
      ...config,
      seller: { ...config.seller, identifiers: config.seller.identifiers.filter((item) => item.label.trim() && item.value.trim()) },
      paymentDetails: config.paymentDetails.filter((item) => item.label.trim() && item.value.trim()),
      terms: config.terms.map((term) => term.trim()).filter(Boolean),
      customFields: config.customFields.filter((field) => field.label.trim()),
    };
    const request = template ? updateTemplate(template.templateKey, { name, layout, config: clean }) : createTemplate({ name, layout, config: clean, makeDefault });
    void request.then((result) => {
      if (template) { setSaved("Template saved."); onSaved?.(result); }
      else navigate(templatesPath(`/${result.templateKey}`));
    }).catch((reason) => setError(message(reason, "Unable to save the template"))).finally(() => setBusy(false));
  };
  return <div className="template-editor">
    <form className="template-editor-form" aria-label="Template settings" onSubmit={(event) => { event.preventDefault(); save(); }}>
      {error && <Notice>{error}</Notice>}
      {saved && <Notice tone="success">{saved}</Notice>}
      <fieldset>
        <legend>Template</legend>
        <div className="form-grid">
          <label className="form-wide">Template name<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
        </div>
        <div className="layout-choices" role="group" aria-label="Layout">
          {layouts.map((item) => <button key={item.value} type="button" aria-pressed={layout === item.value} onClick={() => setLayout(item.value)}>{item.label}<small>{item.note}</small></button>)}
        </div>
        {!template && <label className="template-check"><input type="checkbox" checked={makeDefault} onChange={(event) => setMakeDefault(event.target.checked)} />Use for new invoices by default</label>}
      </fieldset>

      <fieldset>
        <legend>Branding</legend>
        <div className="image-input">
          {config.branding.logo && <img src={config.branding.logo} alt="Logo" />}
          <label>Logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => image((logo) => section("branding", { logo }), 300 * 1024)(event.target.files?.[0])} /></label>
          {config.branding.logo && <Button type="button" size="sm" onClick={() => section("branding", { logo: null })}>Remove</Button>}
        </div>
        <div className="form-grid">
          <label className="color-input"><input type="color" value={config.branding.primaryColor} onChange={(event) => section("branding", { primaryColor: event.target.value.toUpperCase() })} />Brand colour</label>
          <label className="color-input"><input type="color" value={config.branding.accentColor} onChange={(event) => section("branding", { accentColor: event.target.value.toUpperCase() })} />Accent colour</label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Your company</legend>
        <p>Printed in the “From” block. Leave the legal name empty to use {organizationName ?? "your organization name"}.</p>
        <div className="form-grid">
          <label className="form-wide">Legal name<input maxLength={160} value={config.seller.legalName ?? ""} placeholder={organizationName} onChange={(event) => section("seller", { legalName: event.target.value })} /></label>
          <label>Tagline<input maxLength={160} value={config.seller.tagline ?? ""} placeholder="Executive recruitment · Workforce solutions" onChange={(event) => section("seller", { tagline: event.target.value })} /></label>
          <label>Slogan<input maxLength={160} value={config.seller.subline ?? ""} onChange={(event) => section("seller", { subline: event.target.value })} /></label>
          <label className="form-wide">Address<textarea rows={2} maxLength={500} value={config.seller.address ?? ""} onChange={(event) => section("seller", { address: event.target.value })} /></label>
          <label>Phone<input maxLength={64} value={config.seller.phone ?? ""} onChange={(event) => section("seller", { phone: event.target.value })} /></label>
          <label>Email<input type="email" maxLength={254} value={config.seller.email ?? ""} onChange={(event) => section("seller", { email: event.target.value })} /></label>
          <label>Website<input maxLength={120} value={config.seller.website ?? ""} onChange={(event) => section("seller", { website: event.target.value })} /></label>
          <label>State / region<input maxLength={64} value={config.seller.region ?? ""} placeholder="Maharashtra" onChange={(event) => section("seller", { region: event.target.value })} /></label>
        </div>
        <h4>Registration numbers</h4>
        <LabelledList items={config.seller.identifiers} labelHint="GSTIN, PAN, CIN, VAT…" max={8} onChange={(identifiers) => section("seller", { identifiers })} addLabel="Add registration number" />
      </fieldset>

      <fieldset>
        <legend>Document wording</legend>
        <div className="form-grid">
          <label>Title<input maxLength={40} value={config.document.title} onChange={(event) => section("document", { title: event.target.value })} /></label>
          <label>Subtitle<input maxLength={40} value={config.document.subtitle ?? ""} placeholder="Tax invoice" onChange={(event) => section("document", { subtitle: event.target.value })} /></label>
          <label>Copy label<input maxLength={40} value={config.document.copyLabel ?? ""} placeholder="Original for recipient" onChange={(event) => section("document", { copyLabel: event.target.value })} /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Numbering</legend>
        <p>Use {"{SEQ}"} for the serial and optionally {"{FY}"}, {"{YYYY}"}, {"{YY}"} or {"{MM}"}. The serial restarts whenever the text around it changes, so {"{FY}"} restarts it each financial year.</p>
        <div className="form-grid">
          <label>Pattern<input required maxLength={40} value={config.numbering.pattern} onChange={(event) => section("numbering", { pattern: event.target.value })} /></label>
          <label>Serial digits<input type="number" min={1} max={9} value={config.numbering.padding} onChange={(event) => section("numbering", { padding: Number(event.target.value) || 1 })} /></label>
          <Dropdown label="Financial year starts" value={String(config.numbering.fiscalYearStartMonth)} options={monthOptions} onChange={(value) => section("numbering", { fiscalYearStartMonth: Number(value) })} />
        </div>
        <p className="snapshot-note">{patternChanged ? <>Next invoice: <strong>{patternChanged}</strong></> : <>Example: <strong>{example}</strong></>}</p>
      </fieldset>

      <fieldset>
        <legend>Tax and line items</legend>
        <div className="form-grid">
          <Dropdown label="Tax presentation" value={config.tax.mode} onChange={(mode) => section("tax", { mode: mode as TemplateConfig["tax"]["mode"], label: mode === "GST" ? "GST" : config.tax.label === "GST" ? "Tax" : config.tax.label })}
            options={[{ value: "GST", label: "Indian GST", subLabel: "CGST + SGST or IGST by place of supply" }, { value: "SIMPLE", label: "Single tax line", subLabel: "VAT, sales tax…" }, { value: "NONE", label: "No tax" }]} />
          {config.tax.mode === "SIMPLE" && <label>Tax label<input maxLength={24} value={config.tax.label} onChange={(event) => section("tax", { label: event.target.value })} /></label>}
          <label className="template-check"><input type="checkbox" checked={config.columns.showItemCode} onChange={(event) => section("columns", { showItemCode: event.target.checked })} />Item code column</label>
          {config.columns.showItemCode && <label>Code column label<input maxLength={24} value={config.columns.itemCodeLabel} placeholder="SAC, HSN, SKU…" onChange={(event) => section("columns", { itemCodeLabel: event.target.value })} /></label>}
        </div>
        {config.tax.mode === "GST" && !config.seller.region && <Notice tone="info">Add your state under “Your company” so supplies within it show CGST + SGST.</Notice>}
      </fieldset>

      <fieldset>
        <legend>Invoice fields for your industry</legend>
        <p>Captured on every invoice and printed in their own section, for example Candidate and Joining date for recruitment.</p>
        <div className="form-grid"><label className="form-wide">Section heading<input maxLength={60} value={config.document.detailsTitle} onChange={(event) => section("document", { detailsTitle: event.target.value })} /></label></div>
        <FieldList fields={config.customFields} savedKeys={savedKeys} onChange={(customFields) => set("customFields", customFields)} />
      </fieldset>

      <fieldset>
        <legend>Payment and terms</legend>
        <LabelledList items={config.paymentDetails} labelHint="Bank, A/C No., IFSC, UPI, SWIFT…" max={10} onChange={(paymentDetails) => set("paymentDetails", paymentDetails)} addLabel="Add payment detail" />
        <div className="form-grid">
          <label className="form-wide">Terms and conditions (one per line)<textarea rows={3} value={config.terms.join("\n")} onChange={(event) => set("terms", event.target.value.split("\n").slice(0, 10))} /></label>
          <label className="form-wide">Default notes on new invoices<textarea rows={2} maxLength={2000} value={config.defaultNotes ?? ""} onChange={(event) => set("defaultNotes", event.target.value)} /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Signature and footer</legend>
        <div className="form-grid">
          <label>Signatory name<input maxLength={120} value={config.signatory.name ?? ""} onChange={(event) => section("signatory", { name: event.target.value })} /></label>
          <label>Signatory title<input maxLength={80} value={config.signatory.title ?? ""} onChange={(event) => section("signatory", { title: event.target.value })} /></label>
        </div>
        <div className="image-input">
          {config.signatory.signatureImage && <img src={config.signatory.signatureImage} alt="Signature" />}
          <label>Signature image<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => image((signatureImage) => section("signatory", { signatureImage }), 150 * 1024)(event.target.files?.[0])} /></label>
          {config.signatory.signatureImage && <Button type="button" size="sm" onClick={() => section("signatory", { signatureImage: null })}>Remove</Button>}
        </div>
        <div className="form-grid">
          <label className="form-wide">Footer note<input maxLength={300} value={config.footerNote ?? ""} onChange={(event) => set("footerNote", event.target.value)} /></label>
          <Dropdown label="Date style" value={config.dateStyle} onChange={(value) => set("dateStyle", value as TemplateConfig["dateStyle"])}
            options={[{ value: "ORDINAL", label: "30th May 2026" }, { value: "MEDIUM", label: "30 May 2026" }, { value: "NUMERIC", label: "30/05/2026" }]} />
          <label className="template-check"><input type="checkbox" checked={config.showAmountInWords} onChange={(event) => set("showAmountInWords", event.target.checked)} />Show amount in words</label>
        </div>
      </fieldset>

      <div className="form-actions">
        <Button variant="primary" disabled={busy || !name.trim()}>{busy ? "Saving…" : template ? "Save template" : "Create template"}</Button>
        <Link className="button secondary" to={templatesPath()}>Back to templates</Link>
      </div>
    </form>
    <section className="template-editor-preview" aria-label="Preview">
      <p>Preview with sample data · {layouts.find((item) => item.value === layout)?.label} layout</p>
      <InvoiceDocument data={sampleDocument(config, patternChanged ?? example)} template={{ templateKey: template?.templateKey ?? null, name, layout, config }}
        fallbackSellerName={organizationName} locale={defaults.locale} />
    </section>
  </div>;
}

function LabelledList({ items, onChange, labelHint, addLabel, max }: { items: LabelledValue[]; onChange(items: LabelledValue[]): void; labelHint: string; addLabel: string; max: number }) {
  const update = (index: number, change: Partial<LabelledValue>) => onChange(items.map((item, position) => position === index ? { ...item, ...change } : item));
  return <div>
    {items.map((item, index) => <div className="template-row" key={index}>
      <label>Label<input maxLength={40} value={item.label} placeholder={labelHint} onChange={(event) => update(index, { label: event.target.value })} /></label>
      <label>Value<input maxLength={160} value={item.value} onChange={(event) => update(index, { value: event.target.value })} /></label>
      <Button type="button" size="sm" aria-label={`Remove ${item.label || "row"}`} onClick={() => onChange(items.filter((_, position) => position !== index))}>Remove</Button>
    </div>)}
    <Button type="button" size="sm" disabled={items.length >= max} onClick={() => onChange([...items, { label: "", value: "" }])}>{addLabel}</Button>
  </div>;
}

function FieldList({ fields, savedKeys, onChange }: { fields: CustomField[]; savedKeys: Set<string>; onChange(fields: CustomField[]): void }) {
  const update = (index: number, change: Partial<CustomField>) => onChange(fields.map((field, position) => {
    if (position !== index) return field;
    const next = { ...field, ...change };
    // A new field's key follows its label; a saved field's key never changes, because invoices store values under it.
    if (change.label !== undefined && !savedKeys.has(field.key)) next.key = uniqueKey(fieldKey(change.label), fields, index);
    return next;
  }));
  return <div>
    {fields.map((field, index) => <div className="template-row fields" key={index}>
      <label>Field label<input maxLength={40} value={field.label} onChange={(event) => update(index, { label: event.target.value })} /></label>
      <Dropdown label="Type" value={field.type} onChange={(type) => update(index, { type: type as CustomField["type"] })}
        options={[{ value: "TEXT", label: "Text" }, { value: "DATE", label: "Date" }, { value: "NUMBER", label: "Number" }]} />
      <label className="template-check"><input type="checkbox" checked={Boolean(field.required)} onChange={(event) => update(index, { required: event.target.checked })} />Required</label>
      <Button type="button" size="sm" aria-label={`Remove ${field.label || "field"}`} onClick={() => onChange(fields.filter((_, position) => position !== index))}>Remove</Button>
    </div>)}
    <Button type="button" size="sm" disabled={fields.length >= 8} onClick={() => onChange([...fields, { key: uniqueKey("field", fields, -1), label: "", type: "TEXT", required: false }])}>Add field</Button>
  </div>;
}

function uniqueKey(base: string, fields: CustomField[], self: number): string {
  let key = base, suffix = 2;
  while (fields.some((field, index) => index !== self && field.key === key)) key = `${base}${suffix++}`;
  return key;
}
