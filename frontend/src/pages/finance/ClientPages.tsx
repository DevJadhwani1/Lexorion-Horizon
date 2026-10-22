import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ApiError, type Page as ResultPage } from "../../api/types";
import { appPath } from "../../app/hostRouting";
import { StatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { Dropdown } from "../../components/ui/Dropdown";
import { Empty, Notice, Page } from "../../components/ui/Page";
import { PhoneInput } from "../../components/ui/PhoneInput";
import { COUNTRIES, COUNTRIES_BY_CODE } from "../../data/countries";
import { CURRENCIES } from "../../data/currencies";
import { PAYMENT_TERMS, STATE_OPTIONS, formatBillingMoney, gstinProblem, gstinState, termsLabel } from "../../features/finance/billingData";
import { createClient, getClient, getClients, getInvoices, updateClient, type BillingClient, type ClientInput, type InvoiceSummary } from "../../features/finance/financeApi";
import { useOrganizationDefaults } from "../../features/organization/useOrganizationDefaults";
import { formatDate, keyFromName } from "../../lib/format";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { Table } from "../admin/AdminPage";
import { Pagination } from "../workforce/WorkforcePage";
import { ClientStatement } from "./BooksPages";

const clientsPath = (path = "") => appPath(`/app/finance/clients${path}`);
const clientPath = (client: { clientKey: string }) => clientsPath(`/${encodeURIComponent(client.clientKey)}`);
const newInvoicePath = (client: { clientKey: string }) => appPath(`/app/finance/invoices/new?client=${encodeURIComponent(client.clientKey)}`);
const message = (reason: unknown, fallback: string) => reason instanceof ApiError || reason instanceof Error ? reason.message : fallback;
const CLIENT_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const PAGE_SIZE = 20;

export function ClientPages({ section }: { section: "list" | "new" | "profile" }) {
  const key = useWorkspace().workspace?.key;
  if (section === "new") return <NewClient key={key} />;
  if (section === "profile") return <ClientProfile key={key} />;
  return <ClientList key={key} />;
}

export const countryName = (code: string | null | undefined) => (code && COUNTRIES_BY_CODE.get(code)?.name) || code || "";
const location = (client: Pick<BillingClient, "region" | "country">) => [client.region, client.country && client.country !== "IN" ? countryName(client.country) : null].filter(Boolean).join(", ");

const countryOptions = COUNTRIES.map((country) => ({ value: country.code, label: `${country.flag} ${country.name}`, keywords: [country.name, country.code] }));
const currencyOptions = CURRENCIES.map((currency) => ({ value: currency.code, label: `${currency.code} · ${currency.name}`, subLabel: currency.symbol, keywords: [currency.name] }));

/**
 * Client inputs in three sections, named like the Finance API so the form can submit `FormData` directly.
 * India-specific help: the tax ID is a GSTIN, validated as typed, and its state code fills in the state.
 */
export function ClientFields({ client, defaultCurrency, onNameChange, keyField }: {
  client?: BillingClient; defaultCurrency: string; onNameChange?(name: string): void;
  /** Create only (client codes never change): the code field, prefilled from the name. */
  keyField?: { value: string; suggestion: string; onChange(value: string): void; error?: string };
}) {
  const [country, setCountry] = useState(client?.country ?? (defaultCurrency === "INR" || !defaultCurrency ? "IN" : ""));
  const [region, setRegion] = useState(client?.region ?? "");
  const [taxId, setTaxId] = useState(client?.taxId ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [stateFilled, setStateFilled] = useState("");
  const initialTerms = String(client?.paymentTermsDays ?? 30);
  const [terms, setTerms] = useState(PAYMENT_TERMS.some((item) => item.value === initialTerms) ? initialTerms : "custom");
  const [customTerms, setCustomTerms] = useState(initialTerms);
  const india = country === "IN";
  const taxProblem = india ? gstinProblem(taxId) : null;
  const keyId = useId(), taxHint = useId();
  return <>
    <fieldset className="form-section">
      <legend>Company and contact</legend>
      <div className="form-grid">
        <label>Client name<input name="displayName" required maxLength={160} defaultValue={client?.displayName ?? ""} autoComplete="off"
          onChange={(event) => onNameChange?.(event.target.value)} placeholder="Registered business name" /></label>
        {keyField && <div className="field">
          <label htmlFor={keyId}>Client code</label>
          <input id={keyId} name="clientKey" required maxLength={63} value={keyField.value} spellCheck={false} autoComplete="off"
            aria-invalid={Boolean(keyField.error)} aria-describedby={`${keyId}-help`} onChange={(event) => keyField.onChange(event.target.value.toLowerCase())} />
          <small id={`${keyId}-help`} className={keyField.error ? "field-error" : "field-hint"} role={keyField.error ? "alert" : undefined}>
            {keyField.error || (keyField.value === keyField.suggestion ? "Made from the name. Used in links; it cannot change later." : "Custom code. Lowercase letters, numbers and hyphens.")}
          </small>
        </div>}
        <label><span>Attention <span className="field-optional">(optional)</span></span>
          <input name="contactName" maxLength={120} defaultValue={client?.contactName ?? ""} placeholder="Ramya Chandran · Accounts Payable" /></label>
        <label><span>Billing email <span className="field-optional">(optional)</span></span>
          <input name="email" type="email" maxLength={254} defaultValue={client?.email ?? ""} placeholder="accounts@client.com" /></label>
        <PhoneInput name="phone" label="Phone" value={phone} onChange={setPhone} defaultCountryCode={country || "IN"} />
      </div>
    </fieldset>
    <fieldset className="form-section">
      <legend>Address and tax</legend>
      <div className="form-grid">
        <Dropdown label="Country" name="country" value={country} searchable placeholder="Choose a country"
          onChange={(next) => {
            // An Indian state means nothing abroad, and free text is not a state: keep the region only when it still fits.
            setRegion((current) => next === "IN" ? (STATE_OPTIONS.some((option) => option.value === current) ? current : "") : country === "IN" ? "" : current);
            setCountry(next); setStateFilled("");
          }} options={countryOptions} />
        {india
          ? <Dropdown label="State" name="region" value={region} searchable placeholder="Choose a state" hint={stateFilled || "Used as the place of supply for GST."}
              onChange={(next) => { setRegion(next); setStateFilled(""); }} options={[{ value: "", label: "Not set" }, ...STATE_OPTIONS]} />
          : <label><span>State / region <span className="field-optional">(optional)</span></span>
              <input name="region" maxLength={64} value={region} onChange={(event) => setRegion(event.target.value)} /></label>}
        <div className="field">
          <label><span>{india ? "GSTIN" : "Tax / VAT ID"} <span className="field-optional">(optional)</span></span>
            <input name="taxId" maxLength={32} value={taxId} spellCheck={false} autoComplete="off" aria-invalid={Boolean(taxProblem)} aria-describedby={taxHint}
              placeholder={india ? "27AAACM9908Q2ZP" : ""}
              onChange={(event) => {
                const next = india ? event.target.value.toUpperCase().replaceAll(/\s+/g, "") : event.target.value;
                setTaxId(next);
                const state = india && !gstinProblem(next) ? gstinState(next) : null;
                if (state && state !== region) { setRegion(state); setStateFilled(`Filled in from the GSTIN: registered in ${state}.`); }
              }} />
          </label>
          <small id={taxHint} className={taxProblem ? "field-error" : "field-hint"} role={taxProblem ? "alert" : undefined}>
            {taxProblem ?? (india ? "15 characters. The state is filled in from it." : "Printed on the bill as the client's tax ID.")}
          </small>
        </div>
        <label className="form-wide"><span>Billing address <span className="field-optional">(optional)</span></span>
          <textarea name="billingAddress" rows={3} maxLength={500} defaultValue={client?.billingAddress ?? ""} placeholder={"Building, street\nCity, PIN code"} /></label>
      </div>
    </fieldset>
    <fieldset className="form-section">
      <legend>Billing terms</legend>
      <div className="form-grid">
        <Dropdown label="Billing currency" name="currency" required searchable defaultValue={client?.currency ?? (defaultCurrency || "INR")} options={currencyOptions}
          hint={client ? "Applies to new invoices. Existing invoices keep their currency." : undefined} />
        <Dropdown label="Payment terms" value={terms} onChange={setTerms} hint="Sets each invoice's default due date."
          options={[...PAYMENT_TERMS, { value: "custom", label: "Custom…", subLabel: "Any number of days" }]} />
        {terms === "custom"
          ? <label>Days to pay<input name="paymentTermsDays" type="number" required min={0} max={365} value={customTerms} onChange={(event) => setCustomTerms(event.target.value)} /></label>
          : <input type="hidden" name="paymentTermsDays" value={terms} />}
      </div>
    </fieldset>
  </>;
}

/** Form values as the API expects: trimmed, numbers converted; empty optional values become undefined (create) or "" (clear on update). */
function clientBody(form: HTMLFormElement, updating: boolean): ClientInput & Record<string, unknown> {
  const values = Object.fromEntries(new FormData(form)) as Record<string, string>;
  const body: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(values)) {
    const value = String(raw).trim();
    if (key === "paymentTermsDays") body[key] = Number(value);
    else if (value || updating) body[key] = value;
  }
  if (updating) delete body.clientKey;
  return body as ClientInput & Record<string, unknown>;
}

function ClientList() {
  const defaults = useOrganizationDefaults();
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "", status = params.get("status") ?? "ACTIVE", sort = params.get("sort") ?? "name";
  const page = Math.max(0, Number(params.get("page") ?? 0) || 0);
  const [draft, setDraft] = useState(search);
  const [clients, setClients] = useState<BillingClient[] | null>(null), [error, setError] = useState("");
  useEffect(() => { getClients().then(setClients).catch((reason) => setError(message(reason, "Unable to load clients"))); }, []);
  const update = (changes: Record<string, string>) => setParams((previous) => {
    const next = new URLSearchParams(previous);
    for (const [key, value] of Object.entries(changes)) if (value) next.set(key, value); else next.delete(key);
    if (!("page" in changes)) next.delete("page");
    return next;
  }, { replace: true });
  useEffect(() => { setDraft(search); }, [search]);
  useEffect(() => {
    if (draft === search) return;
    const timer = window.setTimeout(() => update({ q: draft.trim() }), 300);
    return () => window.clearTimeout(timer);
  }, [draft]);
  const matching = useMemo(() => {
    const term = search.toLowerCase();
    const list = (clients ?? []).filter((client) => (status === "ALL" || client.status === status)
      && (!term || [client.displayName, client.clientKey, client.email, client.taxId, client.contactName].some((value) => value?.toLowerCase().includes(term))));
    return list.sort(sort === "outstanding" ? (a, b) => b.outstandingAmount - a.outstandingAmount || a.displayName.localeCompare(b.displayName)
      : sort === "recent" ? (a, b) => b.createdAt.localeCompare(a.createdAt) : (a, b) => a.displayName.localeCompare(b.displayName));
  }, [clients, search, status, sort]);
  const filtered = Boolean(search) || status !== "ACTIVE";
  const visible = matching.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  return <Page title="Clients" description="The companies and people you bill. Open a client to see their invoices, balance and billing details."
    actions={<Link className="button primary" to={clientsPath("/new")}>Add client</Link>}>
    <form className="toolbar filter-bar directory-filters" role="search" onSubmit={(event) => { event.preventDefault(); update({ q: draft.trim() }); }}>
      <label>Search clients<input type="search" placeholder="Name, code, email or GSTIN" value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
      <Dropdown label="Status" value={status} onChange={(next) => update({ status: next === "ACTIVE" ? "" : next })}
        options={[{ value: "ACTIVE", label: "Active" }, { value: "ARCHIVED", label: "Archived" }, { value: "ALL", label: "All clients" }]} />
      <Dropdown label="Sort by" value={sort} onChange={(next) => update({ sort: next === "name" ? "" : next })}
        options={[{ value: "name", label: "Name (A–Z)" }, { value: "outstanding", label: "Outstanding (highest first)" }, { value: "recent", label: "Recently added" }]} />
      {filtered && <Button type="button" onClick={() => { setDraft(""); setParams(new URLSearchParams(), { replace: true }); }}>Clear filters</Button>}
    </form>
    {error && <Notice>{error}</Notice>}
    {!clients && !error ? <p role="status">Loading clients…</p> : visible.length ? <>
      <Table headers={["Client", "Contact", "Location", "Billing", "Outstanding", "Status"]}>
        {visible.map((client) => <tr key={client.clientKey}>
          <td><Link to={clientPath(client)}>{client.displayName}</Link><small className="cell-note">{client.clientKey}</small></td>
          <td>{client.contactName || client.email || "—"}{client.contactName && client.email && <small className="cell-note">{client.email}</small>}</td>
          <td>{location(client) || "—"}</td>
          <td>{client.currency}<small className="cell-note">{termsLabel(client.paymentTermsDays)}</small></td>
          <td>{client.openInvoices ? <>{formatBillingMoney(client.outstandingAmount, client.currency, defaults.locale)}<small className="cell-note">{client.openInvoices} open invoice{client.openInvoices === 1 ? "" : "s"}</small></> : "—"}</td>
          <td><StatusBadge status={client.status} /></td>
        </tr>)}
      </Table>
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(matching.length / PAGE_SIZE))} total={matching.length} size={PAGE_SIZE} onPage={(next) => update({ page: next ? String(next) : "" })} />
    </> : filtered
      ? <Empty>No clients match these filters. <button type="button" className="link-button" onClick={() => { setDraft(""); setParams(new URLSearchParams(), { replace: true }); }}>Clear filters</button></Empty>
      : <Empty><strong>No clients yet.</strong><br />Add the companies you bill, then raise invoices for them. <Link to={clientsPath("/new")}>Add client</Link></Empty>}
  </Page>;
}

/** Guided client setup: details, then a review with the next steps. `?client=KEY` reopens the review after saving. */
function NewClient() {
  const defaults = useOrganizationDefaults();
  const [params, setParams] = useSearchParams();
  const savedKey = params.get("client");
  const [saved, setSaved] = useState<BillingClient | null>(null);
  const [existing, setExisting] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [key, setKey] = useState(""), [keyEdited, setKeyEdited] = useState(false);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { getClients().then((list) => setExisting(list.map((client) => client.clientKey))).catch(() => undefined); }, []);
  useEffect(() => {
    if (!savedKey) { setSaved(null); return; }
    getClient(savedKey).then(setSaved).catch((reason) => setError(message(reason, "Unable to load the client")));
  }, [savedKey]);
  const suggestion = useMemo(() => {
    const base = keyFromName(name) || "";
    if (!base) return "";
    let candidate = base, suffix = 2;
    while (existing.includes(candidate)) candidate = `${base.slice(0, 60)}-${suffix++}`;
    return candidate;
  }, [name, existing]);
  const code = keyEdited ? key : suggestion;
  const keyError = code && !CLIENT_KEY_PATTERN.test(code) ? "Use lowercase letters, numbers and single hyphens, for example mastek-ltd."
    : existing.includes(code) ? `${code} is already used by another client.` : "";
  const steps = ["Client details", "Review"];
  const position = saved ? 1 : 0;
  return <Page title={saved ? saved.displayName : "Add client"} description="Enter who you bill and how they pay. You can raise their first invoice straight after.">
    <ol className="stepper" aria-label="Setup progress">
      {steps.map((title, index) => <li key={title} className={index < position ? "done" : index === position ? "current" : ""} aria-current={index === position ? "step" : undefined}>
        <span aria-hidden="true">{index < position ? "✓" : index + 1}</span>{title}
      </li>)}
    </ol>
    {error && <Notice>{error}</Notice>}
    <section className="card wizard-step">
      {!saved ? <form aria-label="Client details" onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (keyError || !code) return;
        if (event.currentTarget.querySelector("[aria-invalid=true]")) { setError("Fix the highlighted fields first."); return; }
        setBusy(true); setError("");
        void createClient({ ...clientBody(event.currentTarget, false), clientKey: code })
          .then((created) => { setSaved(created); setParams({ client: created.clientKey }, { replace: true }); })
          .catch((reason) => setError(message(reason, "Unable to save the client")))
          .finally(() => setBusy(false));
      }}>
        <h2>Client details</h2>
        <ClientFields defaultCurrency={defaults.currency} onNameChange={setName}
          keyField={{ value: code, suggestion, error: keyError, onChange: (value) => { setKey(value); setKeyEdited(value !== suggestion); } }} />
        <div className="form-actions">
          <Button variant="primary" disabled={busy || !defaults.loaded}>{busy ? "Saving…" : "Save client"}</Button>
          <Link className="button secondary" to={clientsPath()}>Cancel</Link>
        </div>
      </form> : <div aria-label="Client review">
        <h2>{saved.displayName} is ready to bill</h2>
        <ul className="setup-summary review-list">
          <li className="done"><span><strong>Client</strong> · {saved.clientKey}{saved.contactName ? ` · Attn. ${saved.contactName}` : ""}</span><Link to={clientPath(saved)}>Edit</Link></li>
          <li className={saved.billingAddress ? "done" : "todo"}><span><strong>Billing address</strong> · {saved.billingAddress ? location(saved) || "Added" : "Not added — the bill will show only the name."}</span><Link to={clientPath(saved)}>{saved.billingAddress ? "Edit" : "Add"}</Link></li>
          <li className={saved.taxId || saved.country !== "IN" ? "done" : "todo"}><span><strong>{saved.country === "IN" ? "GSTIN" : "Tax ID"}</strong> · {saved.taxId || (saved.country === "IN" ? "Not added — needed on a GST tax invoice for registered clients." : "Not added")}</span><Link to={clientPath(saved)}>{saved.taxId ? "Edit" : "Add"}</Link></li>
          <li className="done"><span><strong>Billing</strong> · {saved.currency} · {termsLabel(saved.paymentTermsDays)}{saved.region ? ` · place of supply ${saved.region}` : ""}</span><Link to={clientPath(saved)}>Edit</Link></li>
        </ul>
        <div className="form-actions">
          <Link className="button primary" to={newInvoicePath(saved)}>Create an invoice for {saved.displayName}</Link>
          <Link className="button secondary" to={clientPath(saved)}>View client</Link>
          <Button type="button" onClick={() => { setExisting((list) => [...list, saved.clientKey]); setName(""); setKey(""); setKeyEdited(false); setSaved(null); setParams({}, { replace: true }); }}>Add another client</Button>
        </div>
      </div>}
    </section>
  </Page>;
}

function ClientProfile() {
  const { clientKey = "" } = useParams();
  const defaults = useOrganizationDefaults();
  const [client, setClient] = useState<BillingClient | null>(null);
  const [invoices, setInvoices] = useState<ResultPage<InvoiceSummary> | null>(null);
  const [error, setError] = useState(""), [saved, setSaved] = useState(""), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false);
  const [ask, confirmDialog] = useConfirm();
  const load = () => Promise.all([getClient(clientKey), getInvoices({ clientKey, size: 10, page: 0 })])
    .then(([value, list]) => { setClient(value); setInvoices(list); })
    .catch((reason) => setError(message(reason, "Unable to load the client")));
  useEffect(() => { void load(); }, [clientKey]);
  if (error && !client) return <Page title="Client"><Notice>{error}</Notice><Link to={clientsPath()}>Back to clients</Link></Page>;
  if (!client) return <Page title="Client"><p role="status">Loading client…</p></Page>;
  const money = (value: number) => formatBillingMoney(value, client.currency, client.currency === "INR" ? "en-IN" : defaults.locale);
  const archive = async () => {
    const archiving = client.status === "ACTIVE";
    if (!(await ask({ title: archiving ? `Archive ${client.displayName}?` : `Restore ${client.displayName}?`, confirmLabel: archiving ? "Archive client" : "Restore client", tone: archiving ? "destructive" : "primary",
      body: archiving ? "Archived clients can't receive new invoices. Their existing invoices and payments are kept." : "They can receive invoices again." }))) return;
    setBusy(true); setError("");
    void updateClient(client.clientKey, { status: archiving ? "ARCHIVED" : "ACTIVE" })
      .then(async () => { setSaved(archiving ? "Client archived." : "Client restored."); await load(); })
      .catch((reason) => setError(message(reason, "Unable to update the client"))).finally(() => setBusy(false));
  };
  const actions = !editing ? <div className="toolbar">
    {client.status === "ACTIVE" && <Link className="button primary" to={newInvoicePath(client)}>New invoice</Link>}
    <Button onClick={() => { setEditing(true); setSaved(""); }}>Edit details</Button>
    <Button variant={client.status === "ACTIVE" ? "destructive" : "secondary"} disabled={busy} onClick={() => void archive()}>{client.status === "ACTIVE" ? "Archive" : "Restore"}</Button>
  </div> : undefined;
  return <Page title={client.displayName} description={[client.clientKey, client.email].filter(Boolean).join(" · ")} actions={actions}>
    {confirmDialog}
    <p><Link to={clientsPath()}>← All clients</Link></p>
    {error && <Notice>{error}</Notice>}
    {saved && <Notice tone="success">{saved}</Notice>}
    {editing ? <form className="card employee-form" aria-label={`Edit ${client.displayName}`} onSubmit={(event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (event.currentTarget.querySelector("[aria-invalid=true]")) { setError("Fix the highlighted fields first."); return; }
      setBusy(true); setError("");
      void updateClient(client.clientKey, clientBody(event.currentTarget, true))
        .then(async () => { setEditing(false); setSaved("Client details saved. Drafts and new invoices use them; issued invoices keep the details they were issued with."); await load(); })
        .catch((reason) => setError(message(reason, "Unable to save the client"))).finally(() => setBusy(false));
    }}>
      <ClientFields client={client} defaultCurrency={defaults.currency} />
      <div className="form-actions">
        <Button variant="primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        <Button type="button" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </form> : <div className="cards">
      <article>
        <h3>Contact</h3>
        <dl className="detail-list">
          <div><dt>Status</dt><dd><StatusBadge status={client.status} /></dd></div>
          <div><dt>Attention</dt><dd>{client.contactName || "—"}</dd></div>
          <div><dt>Email</dt><dd>{client.email || "—"}</dd></div>
          <div><dt>Phone</dt><dd>{client.phone || "—"}</dd></div>
        </dl>
      </article>
      <article>
        <h3>Billing and tax</h3>
        <dl className="detail-list">
          <div><dt>Address</dt><dd className="finance-address">{client.billingAddress || "—"}</dd></div>
          <div><dt>Location</dt><dd>{[client.region, countryName(client.country)].filter(Boolean).join(", ") || "—"}</dd></div>
          <div><dt>{client.country === "IN" ? "GSTIN" : "Tax ID"}</dt><dd>{client.taxId || "—"}</dd></div>
          <div><dt>Terms</dt><dd>{client.currency} · {termsLabel(client.paymentTermsDays)}</dd></div>
        </dl>
      </article>
      <article>
        <h3>Receivables</h3>
        <dl className="detail-list">
          <div><dt>Outstanding</dt><dd><strong>{money(client.outstandingAmount)}</strong></dd></div>
          <div><dt>Open invoices</dt><dd>{client.openInvoices}</dd></div>
          <div><dt>Client since</dt><dd>{formatDate(client.createdAt.slice(0, 10), defaults.locale)}</dd></div>
        </dl>
      </article>
    </div>}
    {!editing && <section className="card" aria-labelledby="client-invoices-heading">
      <div className="card-heading">
        <h3 id="client-invoices-heading">Invoices</h3>
        {invoices && invoices.totalElements > invoices.content.length && <Link to={appPath(`/app/finance/invoices?client=${encodeURIComponent(client.clientKey)}`)}>View all {invoices.totalElements}</Link>}
      </div>
      {invoices?.content.length ? <Table headers={["Invoice", "Invoice date", "Due", "Total", "Balance due", "Status"]}>
        {invoices.content.map((invoice) => <tr key={invoice.reference}>
          <td><Link to={appPath(`/app/finance/invoices/${encodeURIComponent(invoice.reference)}`)}>{invoice.invoiceNumber ?? `Draft ${invoice.reference}`}</Link></td>
          <td>{formatDate(invoice.issueDate, defaults.locale)}</td>
          <td>{formatDate(invoice.dueDate, defaults.locale)}</td>
          <td>{formatBillingMoney(invoice.total, invoice.currency, defaults.locale)}</td>
          <td>{invoice.status === "DRAFT" || invoice.status === "VOID" ? "—" : formatBillingMoney(invoice.balanceDue, invoice.currency, defaults.locale)}</td>
          <td><StatusBadge status={invoice.overdue ? "OVERDUE" : invoice.status} /></td>
        </tr>)}
      </Table> : <Empty>No invoices for {client.displayName} yet. {client.status === "ACTIVE" && <Link to={newInvoicePath(client)}>Create the first one</Link>}</Empty>}
    </section>}
    {!editing && <ClientStatement clientKey={client.clientKey} />}
  </Page>;
}
