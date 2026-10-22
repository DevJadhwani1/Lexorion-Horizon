import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/types";
import { appPath } from "../../app/hostRouting";
import { useAuth } from "../../auth/AuthProvider";
import { Button } from "../../components/ui/Button";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { Dropdown } from "../../components/ui/Dropdown";
import { Notice, Page } from "../../components/ui/Page";
import { STATE_OPTIONS, termsLabel } from "../../features/finance/billingData";
import {
  createInvoice, getClients, getInvoice, getItems, getNextNumber, getTemplates, issueInvoice, lineAmounts, updateInvoice,
  type BillableItem, type BillingClient, type Invoice, type InvoiceInput, type InvoiceTemplate, type TaxLine, type TemplateConfig,
} from "../../features/finance/financeApi";
import { useOrganizationDefaults } from "../../features/organization/useOrganizationDefaults";
import { formatDate, formatMoney } from "../../lib/format";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { countryName } from "./ClientPages";
import { addDays, localToday } from "./FinancePage";
import { InvoiceDocument, type DocumentData } from "./InvoiceDocument";
import { UNITS } from "./ItemPages";

const financePath = (path = "") => appPath(`/app/finance${path}`);
const message = (reason: unknown, fallback: string) => reason instanceof ApiError || reason instanceof Error ? reason.message : fallback;
type Step = "details" | "items";
const STEPS: { key: Step; title: string }[] = [{ key: "details", title: "Client and details" }, { key: "items", title: "Line items and save" }];

interface LineDraft { itemCode: string; hsnSac: string; unit: string; description: string; quantity: string; unitPrice: string; taxRate: string }
const emptyLine = (taxRate = ""): LineDraft => ({ itemCode: "", hsnSac: "", unit: "", description: "", quantity: "1", unitPrice: "", taxRate });

/** New invoice (`/invoices/new?client=KEY`) or a draft being edited (`/invoices/:reference/edit`). */
export function InvoiceWizardPage({ mode }: { mode: "new" | "edit" }) {
  const key = useWorkspace().workspace?.key;
  const { reference = "" } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null), [error, setError] = useState("");
  useEffect(() => {
    if (mode !== "edit") return;
    getInvoice(reference).then(setInvoice).catch((reason) => setError(message(reason, "Unable to load the invoice")));
  }, [mode, reference]);
  if (mode === "edit") {
    if (error) return <Page title="Edit invoice"><Notice>{error}</Notice></Page>;
    if (!invoice) return <Page title="Edit invoice"><p role="status">Loading invoice…</p></Page>;
    if (invoice.status !== "DRAFT") return <Page title={invoice.invoiceNumber ?? reference}><Notice tone="info">Issued invoices can't be edited. <Link to={financePath(`/invoices/${encodeURIComponent(reference)}`)}>Back to the invoice</Link></Notice></Page>;
    return <InvoiceWizard key={`${key}:${reference}`} invoice={invoice} />;
  }
  return <InvoiceWizard key={key} />;
}

/** Mirrors the service's GST presentation so the preview shows the same tax lines the issued bill will. */
function previewTaxes(config: TemplateConfig | undefined, tax: number, placeOfSupply: string): TaxLine[] {
  if (!tax) return [];
  if (!config || config.tax.mode !== "GST") return [{ label: config?.tax.label ?? "Tax", amount: tax }];
  const seller = config.seller.region?.trim().toLowerCase();
  if (seller && placeOfSupply.trim().toLowerCase() === seller) {
    const central = Math.round(tax / 2 * 100) / 100;
    return [{ label: "CGST", amount: central }, { label: "SGST", amount: Math.round((tax - central) * 100) / 100 }];
  }
  return [{ label: "IGST", amount: tax }];
}

function InvoiceWizard({ invoice }: { invoice?: Invoice }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const defaults = useOrganizationDefaults();
  const organizationName = useAuth().organization?.organizationName;
  const [ask, confirmDialog] = useConfirm();
  const [sources, setSources] = useState<{ clients: BillingClient[]; templates: InvoiceTemplate[]; items: BillableItem[] } | null>(null), [loadError, setLoadError] = useState("");
  useEffect(() => {
    Promise.all([getClients(), getTemplates(), getItems().catch(() => [] as BillableItem[])]).then(([clients, templates, items]) => setSources({ clients, templates, items }))
      .catch((reason) => setLoadError(message(reason, "Unable to load clients and templates")));
  }, []);
  const [step, setStep] = useState<Step>("details");
  const [clientKey, setClientKey] = useState(invoice?.clientKey ?? params.get("client") ?? "");
  const [templateKey, setTemplateKey] = useState<string | null>(invoice ? invoice.template.templateKey ?? "" : null);
  const [issueDate, setIssueDate] = useState(invoice?.issueDate ?? localToday());
  const [dueDate, setDueDate] = useState(invoice?.dueDate ?? "");
  const [placeOfSupply, setPlaceOfSupply] = useState<string | null>(invoice ? invoice.placeOfSupply ?? "" : null);
  const [fields, setFields] = useState<Record<string, string>>(invoice?.customFields ?? {});
  const [lines, setLines] = useState<LineDraft[]>(invoice?.lines.map((line) => ({ itemCode: line.itemCode ?? "", hsnSac: line.hsnSac ?? "", unit: line.unit ?? "", description: line.description, quantity: String(line.quantity), unitPrice: String(line.unitPrice), taxRate: line.taxRate ? String(line.taxRate) : "" })) ?? [emptyLine()]);
  const [notes, setNotes] = useState<string | null>(invoice ? invoice.notes ?? "" : null);
  const [nextNumber, setNextNumber] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);

  const clients = (sources?.clients ?? []).filter((client) => client.status === "ACTIVE" || client.clientKey === invoice?.clientKey);
  const templates = (sources?.templates ?? []).filter((template) => template.status === "ACTIVE" || template.templateKey === invoice?.template.templateKey);
  const selectedTemplateKey = templateKey ?? templates.find((template) => template.isDefault)?.templateKey ?? "";
  const template = templates.find((item) => item.templateKey === selectedTemplateKey);
  const config = template?.config ?? (selectedTemplateKey === (invoice?.template.templateKey ?? "") ? invoice?.template.config : undefined);
  const client = clients.find((item) => item.clientKey === clientKey);
  const gst = config?.tax.mode === "GST";
  const showCodes = Boolean(config?.columns.showItemCode);
  const showHsn = Boolean(config?.columns.showHsnSac);
  const registry = (sources?.items ?? []).filter((item) => item.status === "ACTIVE");
  // The client's state (or country, abroad) until someone types a different place of supply.
  const clientPlace = client ? client.region || (client.country && client.country !== "IN" ? countryName(client.country) : "") : "";
  const supply = placeOfSupply ?? clientPlace;
  const due = dueDate || (client && issueDate ? addDays(issueDate, client.paymentTermsDays) : "");
  const currency = client?.currency ?? invoice?.currency ?? defaults.currency ?? "INR";
  const moneyLocale = currency === "INR" ? "en-IN" : defaults.locale;
  const money = (value: number) => formatMoney(value, currency, moneyLocale);
  const amounts = lines.map((line) => lineAmounts({ quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), taxRate: Number(line.taxRate) }));
  const subtotal = amounts.reduce((sum, value) => sum + value.subtotal, 0), tax = amounts.reduce((sum, value) => sum + value.tax, 0);
  const total = Math.round((subtotal + tax) * 100) / 100;
  const position = STEPS.findIndex((item) => item.key === step);

  useEffect(() => {
    setNextNumber("");
    if (!selectedTemplateKey || !/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) return;
    let current = true;
    getNextNumber(selectedTemplateKey, issueDate).then((result) => { if (current) setNextNumber(result.number); }).catch(() => undefined);
    return () => { current = false; };
  }, [selectedTemplateKey, issueDate]);

  const body = (): InvoiceInput => ({
    clientKey, templateKey: selectedTemplateKey || undefined, issueDate, dueDate: dueDate || undefined,
    placeOfSupply: placeOfSupply === null ? undefined : placeOfSupply.trim(),
    notes: notes === null ? undefined : notes.trim(),
    customFields: Object.fromEntries((config?.customFields ?? []).map((field) => [field.key, (fields[field.key] ?? "").trim()]).filter(([, value]) => value)),
    lines: lines.map((line) => ({ itemCode: line.itemCode.trim() || undefined, hsnSac: line.hsnSac.trim() || undefined, unit: line.unit.trim() || undefined, description: line.description.trim(),
      quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), taxRate: line.taxRate ? Number(line.taxRate) : 0 })),
  });
  const missingRequired = (config?.customFields ?? []).filter((field) => field.required && !(fields[field.key] ?? "").trim());
  const save = async (issue: boolean) => {
    if (issue && !(await ask({ title: `Issue this invoice for ${money(total)}?`, confirmLabel: "Save and issue",
      body: `${nextNumber ? `It will be numbered ${nextNumber}. ` : ""}Issued invoices are locked and keep this exact layout, even if the template changes later.` }))) return;
    setBusy(true); setError("");
    try {
      const saved = invoice ? await updateInvoice(invoice.reference, body()) : await createInvoice(body());
      if (issue) await issueInvoice(saved.reference);
      navigate(financePath(`/invoices/${encodeURIComponent(saved.reference)}`));
    } catch (reason) {
      setError(message(reason, "Unable to save the invoice"));
    } finally { setBusy(false); }
  };
  const continueFrom = (event: FormEvent<HTMLFormElement>, next: Step) => { event.preventDefault(); setError(""); setStep(next); };

  const preview: DocumentData = {
    number: null, status: "DRAFT", currency, issueDate, dueDate: due, placeOfSupply: supply || null,
    billTo: client ? { name: client.displayName, contactName: client.contactName, address: client.billingAddress, email: client.email, phone: client.phone, taxId: client.taxId, region: client.region, country: client.country }
      : { name: "—", contactName: null, address: null, email: null, phone: null, taxId: null, region: null },
    customFields: fields,
    lines: lines.map((line, index) => ({ lineNumber: index + 1, itemCode: line.itemCode || null, hsnSac: line.hsnSac || null, unit: line.unit || null, description: line.description || "—", quantity: Number(line.quantity) || 0,
      unitPrice: Number(line.unitPrice) || 0, taxRate: Number(line.taxRate) || 0, subtotal: amounts[index].subtotal, taxAmount: amounts[index].tax, total: amounts[index].total })),
    subtotal, taxBreakdown: previewTaxes(config, tax, supply), total, amountPaid: 0, balanceDue: total, notes: notes ?? config?.defaultNotes ?? null,
  };

  if (loadError) return <Page title="New invoice"><Notice>{loadError}</Notice></Page>;
  if (!sources) return <Page title="New invoice"><p role="status">Loading clients and templates…</p></Page>;
  if (!clients.length) return <Page title="New invoice"><Notice tone="info">Add a client before creating an invoice. <Link to={financePath("/clients/new")}>Add client</Link></Notice></Page>;
  const title = invoice ? `Edit draft ${invoice.reference}` : client ? `New invoice for ${client.displayName}` : "New invoice";
  return <Page title={title} description="Choose who you're billing and add what you're charging for. The bill on the right updates as you type, exactly as the client will see it.">
    {confirmDialog}
    <ol className="stepper" aria-label="Invoice progress">
      {STEPS.map((item, index) => <li key={item.key} className={index < position ? "done" : index === position ? "current" : ""} aria-current={index === position ? "step" : undefined}>
        <span aria-hidden="true">{index < position ? "✓" : index + 1}</span>
        {index < position ? <button type="button" className="link-button" onClick={() => setStep(item.key)}>{item.title}</button> : item.title}
      </li>)}
    </ol>
    {error && <Notice>{error}</Notice>}
    <div className="invoice-composer">
    <section className="card wizard-step">
      {step === "details" && <form aria-label="Client and details" onSubmit={(event) => continueFrom(event, "items")}>
        <h2>Client and details</h2>
        <fieldset className="form-section">
          <legend>Bill to</legend>
          <div className="form-grid">
            <Dropdown label="Client" required value={clientKey} placeholder="Choose a client" searchable onChange={(next) => { setClientKey(next); setPlaceOfSupply(null); }}
              options={clients.map((item) => ({ value: item.clientKey, label: item.displayName, subLabel: `${item.currency} · ${termsLabel(item.paymentTermsDays)}`, keywords: [item.clientKey, item.taxId ?? ""] }))}
              hint={client ? [client.contactName && `Attn. ${client.contactName}`, client.taxId].filter(Boolean).join(" · ") || undefined : undefined} />
            <Dropdown label="Invoice template" value={selectedTemplateKey} onChange={setTemplateKey}
              hint={templates.length ? undefined : "Using the standard format. Design your own under Invoice templates."}
              options={[...templates.map((item) => ({ value: item.templateKey, label: item.name, subLabel: item.isDefault ? "Default" : undefined })), { value: "", label: "Standard format" }]} />
          </div>
          {!clients.some((item) => item.clientKey === clientKey) && <p className="snapshot-note">Billing someone new? <Link to={financePath("/clients/new")}>Add a client</Link> first.</p>}
        </fieldset>
        <fieldset className="form-section">
          <legend>Dates{gst ? " and place of supply" : ""}</legend>
          <div className="form-grid">
            <label>Invoice date<input type="date" required value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></label>
            <div className="field">
              <label>Due date<input type="date" value={dueDate} min={issueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
              <small className="field-hint">{dueDate ? <button type="button" className="link-button" onClick={() => setDueDate("")}>Use the client's payment terms</button>
                : client ? `${formatDate(due, defaults.locale)} from ${termsLabel(client.paymentTermsDays)}.` : "Defaults to the client's payment terms."}</small>
            </div>
            {gst && (!client?.country || client.country === "IN"
              ? <Dropdown label="Place of supply" value={supply} searchable onChange={setPlaceOfSupply} placeholder="Choose a state"
                  hint={config?.seller.region ? (supply && supply === config.seller.region ? "Same state as yours: CGST + SGST." : supply ? "Different state: IGST." : "Choose the state to decide CGST + SGST or IGST.") : "Add your state to the template to split CGST and SGST."}
                  options={STATE_OPTIONS} />
              : <label>Place of supply<input maxLength={64} value={supply} onChange={(event) => setPlaceOfSupply(event.target.value)} /></label>)}
          </div>
        </fieldset>
        {config && config.customFields.length > 0 && <fieldset className="form-section">
          <legend>{config.document.detailsTitle}</legend>
          <div className="form-grid">
            {config.customFields.map((field) => <label key={field.key}>
              <span>{field.label}{field.required ? <span className="field-required-asterisk" aria-hidden="true"> *</span> : <span className="field-optional"> (optional)</span>}</span>
              <input type={field.type === "DATE" ? "date" : field.type === "NUMBER" ? "number" : "text"} step={field.type === "NUMBER" ? "any" : undefined} maxLength={200}
                aria-label={field.label} value={fields[field.key] ?? ""} onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))} />
            </label>)}
          </div>
          {config.customFields.some((field) => field.required) && <p className="snapshot-note">Fields marked * are needed before the invoice can be issued; you can still save a draft without them.</p>}
        </fieldset>}
        <div className="form-actions">
          <Button variant="primary" disabled={!clientKey}>Continue to line items</Button>
          <Link className="button secondary" to={invoice ? financePath(`/invoices/${encodeURIComponent(invoice.reference)}`) : financePath("/invoices")}>Cancel</Link>
        </div>
      </form>}

      {step === "items" && <form aria-label="Line items" onSubmit={(event) => {
        event.preventDefault();
        void save((event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-intent") === "issue");
      }}>
        <h2>Line items</h2>
        <p className="snapshot-note">Amounts are in {currency}{client ? `, ${client.displayName}'s billing currency` : ""}. Tax is worked out per line.</p>
        <ol className="line-list" aria-label="Lines">
          {lines.map((line, index) => {
            const set = (change: Partial<LineDraft>) => setLines((current) => current.map((item, at) => at === index ? { ...item, ...change } : item));
            return <li key={index} className="line-item">
              {registry.length > 0 && <div className="line-pick">
                <Dropdown label={`Line ${index + 1} item or service`} value={registry.some((item) => item.itemCode === line.itemCode) ? line.itemCode : ""} searchable placeholder="Pick from your items and services"
                  onChange={(code) => {
                    const item = registry.find((entry) => entry.itemCode === code);
                    if (!item) { set({ itemCode: "" }); return; }
                    set({ itemCode: item.itemCode, hsnSac: item.hsnSac ?? "", unit: item.unit ?? "", description: item.description || item.name,
                      ...(item.unitPrice !== null ? { unitPrice: String(item.unitPrice) } : {}), ...(item.taxRate !== null ? { taxRate: String(item.taxRate) } : {}) });
                  }}
                  options={[{ value: "", label: "Not from the registry" }, ...registry.map((item) => ({ value: item.itemCode, label: `${item.itemCode} · ${item.name}`,
                    subLabel: [item.hsnSac && `${item.kind === "SERVICE" ? "SAC" : "HSN"} ${item.hsnSac}`, item.unitPrice !== null && money(item.unitPrice)].filter(Boolean).join(" · ") || undefined,
                    keywords: [item.category ?? "", item.hsnSac ?? ""] }))]} />
              </div>}
              <label className="line-description">Description
                <input aria-label={`Line ${index + 1} description`} required maxLength={300} value={line.description} placeholder="Service or item" onChange={(event) => set({ description: event.target.value })} /></label>
              {showCodes && <label>{config?.columns.itemCodeLabel}
                <input aria-label={`Line ${index + 1} ${config?.columns.itemCodeLabel}`} maxLength={32} value={line.itemCode} onChange={(event) => set({ itemCode: event.target.value })} /></label>}
              {(showHsn || line.hsnSac) && <label>HSN/SAC<input aria-label={`Line ${index + 1} HSN/SAC`} inputMode="numeric" maxLength={8} value={line.hsnSac}
                aria-invalid={Boolean(line.hsnSac) && !/^\d{4}(\d{2}){0,2}$/.test(line.hsnSac)} onChange={(event) => set({ hsnSac: event.target.value.replaceAll(/\D/g, "") })} /></label>}
              <label>Qty<input aria-label={`Line ${index + 1} quantity`} required type="number" min="0.0001" step="any" value={line.quantity} onChange={(event) => set({ quantity: event.target.value })} /></label>
              <label>Unit<input aria-label={`Line ${index + 1} unit`} maxLength={16} list="invoice-units" value={line.unit} placeholder="Nos" onChange={(event) => set({ unit: event.target.value })} /></label>
              <label>Unit price<input aria-label={`Line ${index + 1} unit price`} required type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => set({ unitPrice: event.target.value })} /></label>
              <label>Tax %<input aria-label={`Line ${index + 1} tax rate`} type="number" min="0" max="100" step="any" value={line.taxRate} placeholder="0" onChange={(event) => set({ taxRate: event.target.value })} /></label>
              <div className="line-amount"><span>Amount</span><strong>{money(amounts[index].total)}</strong></div>
              {lines.length > 1 && <span className="line-remove"><Button type="button" size="sm" aria-label={`Remove line ${index + 1}`} onClick={() => setLines((current) => current.filter((_, at) => at !== index))}>Remove</Button></span>}
            </li>;
          })}
        </ol>
        <datalist id="invoice-units">{UNITS.map((unit) => <option key={unit} value={unit} />)}</datalist>
        {registry.length === 0 && <p className="snapshot-note">Bill the same services often? <Link to={financePath("/items/new")}>Add them to Items and services</Link> to pick them here with their code, HSN/SAC and rate.</p>}
        <Button type="button" size="sm" disabled={lines.length >= 100} onClick={() => setLines((current) => [...current, emptyLine(current[current.length - 1]?.taxRate ?? "")])}>Add line</Button>
        <dl className="pay-estimate" aria-label="Invoice totals">
          <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
          {previewTaxes(config, tax, supply).map((line) => <div key={line.label}><dt>{line.label}</dt><dd>{money(line.amount)}</dd></div>)}
          <div className="net"><dt>Total</dt><dd>{money(total)}</dd></div>
        </dl>
        <label className="finance-notes">Notes for the client
          <textarea maxLength={2000} rows={3} value={notes ?? config?.defaultNotes ?? ""} onChange={(event) => setNotes(event.target.value)} placeholder="Payment instructions, PO number…" />
        </label>
        {missingRequired.length > 0 && <Notice tone="info">Add {missingRequired.map((field) => field.label).join(", ")} before issuing. <button type="button" className="link-button" onClick={() => setStep("details")}>Go to details</button></Notice>}
        <div className="form-actions">
          <Button variant="primary" data-intent="issue" disabled={busy || missingRequired.length > 0 || total <= 0}>{busy ? "Saving…" : "Save and issue"}</Button>
          <Button data-intent="draft" disabled={busy}>Save draft</Button>
          <Button type="button" disabled={busy} onClick={() => setStep("details")}>Back</Button>
        </div>
      </form>}

    </section>
    <section className="template-editor-preview" aria-label="Live preview">
      <p>Live preview{nextNumber ? <> · numbered <strong>{nextNumber}</strong> when issued</> : ""}</p>
      <InvoiceDocument data={preview} template={{ templateKey: selectedTemplateKey || null, name: template?.name ?? "Standard", layout: template?.layout ?? invoice?.template.layout ?? "MODERN",
        config: config ?? invoice?.template.config ?? { ...previewStandard } }} fallbackSellerName={organizationName} locale={defaults.locale} />
    </section>
    </div>
  </Page>;
}

/** The service's standard format, for previews before any template exists. */
const previewStandard: TemplateConfig = {
  branding: { logo: null, primaryColor: "#1D2B7A", accentColor: "#7CB342" },
  seller: { identifiers: [] }, document: { title: "Invoice", detailsTitle: "Details" },
  numbering: { pattern: "INV-{SEQ}", padding: 5, fiscalYearStartMonth: 4 }, tax: { mode: "SIMPLE", label: "Tax" },
  columns: { showItemCode: false, itemCodeLabel: "Code" }, customFields: [], paymentDetails: [], terms: [],
  signatory: {}, showAmountInWords: true, dateStyle: "MEDIUM",
};
