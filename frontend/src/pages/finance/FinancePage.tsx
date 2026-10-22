import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ApiError, type Page as ResultPage } from "../../api/types";
import { appPath } from "../../app/hostRouting";
import { Badge, StatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Empty, Notice, Page } from "../../components/ui/Page";
import {
  createClient, createInvoice, getBillingSummary, getClients, getInvoice, getInvoicePayments, getInvoices, getPayments,
  issueInvoice, lineAmounts, paymentMethods, recordPayment, updateClient, updateInvoice, voidInvoice,
  type BillingClient, type BillingSummary, type Invoice, type InvoiceStatus, type InvoiceSummary, type Payment, type PaymentMethod,
} from "../../features/finance/financeApi";
import { useOrganizationDefaults } from "../../features/organization/useOrganizationDefaults";
import { formatDate, formatMoney, humanize } from "../../lib/format";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { Table } from "../admin/AdminPage";

const financePath = (path = "") => appPath(`/app/finance${path}`);
const message = (reason: unknown, fallback: string) => reason instanceof ApiError || reason instanceof Error ? reason.message : fallback;

/** Today's date in the browser's time zone as `YYYY-MM-DD`. */
export function localToday(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function FinancePage({ sectionKey }: { sectionKey: "overview" | "invoices" | "new-invoice" | "invoice" | "clients" | "payments" }) {
  const { workspace } = useWorkspace();
  if (!workspace?.products.some((product) => product.key === "finance"))
    return <Page title="Finance"><Notice tone="info">Select a workspace with Finance enabled to manage billing.</Notice></Page>;
  if (sectionKey === "invoices") return <Invoices key={workspace.key} />;
  if (sectionKey === "new-invoice") return <NewInvoice key={workspace.key} />;
  if (sectionKey === "invoice") return <InvoiceDetail key={workspace.key} />;
  if (sectionKey === "clients") return <Clients key={workspace.key} />;
  if (sectionKey === "payments") return <Payments key={workspace.key} />;
  return <Overview key={workspace.key} />;
}

function useLoad<T>(load: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(""), [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    load().then((value) => { if (active) setData(value); }).catch((reason) => { if (active) setError(message(reason, "Unable to load Finance data")); });
    return () => { active = false; };
  }, [version, ...dependencies]);
  return { data, error, reload: () => setVersion((value) => value + 1) };
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return <article><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>;
}

function InvoiceStatusBadges({ invoice }: { invoice: Pick<InvoiceSummary, "status" | "overdue"> }) {
  return <span className="finance-badges"><StatusBadge status={invoice.status} />{invoice.overdue && <Badge label="Overdue" variant="danger" />}</span>;
}

function Overview() {
  const defaults = useOrganizationDefaults();
  const { workspace } = useWorkspace();
  const { data, error } = useLoad(() => Promise.all([getBillingSummary(), getInvoices({ overdue: true, size: 5, page: 0 }), getInvoices({ status: "DRAFT", size: 5, page: 0 })]));
  if (error) return <Page title="Finance"><Notice>{error}</Notice></Page>;
  if (!data) return <Page title="Finance"><p>Loading billing overview…</p></Page>;
  const [summary, overdue, drafts] = data as [BillingSummary, ResultPage<InvoiceSummary>, ResultPage<InvoiceSummary>];
  const money = (value: number, currency: string) => formatMoney(value, currency, defaults.locale);
  const totals = summary.totals.length ? summary.totals : [{ currency: defaults.currency || "INR", outstanding: 0, overdue: 0, invoicedThisMonth: 0, collectedThisMonth: 0, aging: { current: 0, days1To30: 0, days31To60: 0, days61To90: 0, over90: 0 } }];
  const actions = <div className="toolbar">
    <Link className="button primary" to={financePath("/invoices/new")}>New invoice</Link>
    <Link className="button secondary" to={financePath("/clients?new=1")}>New client</Link>
  </div>;
  return <Page title="Finance" description={`Billing and collections for ${workspace?.displayName ?? "this workspace"}, as of ${formatDate(summary.asOf, defaults.locale)}.`} actions={actions}>
    {summary.activeClients === 0 && <Notice tone="info">Start by <Link to={financePath("/clients?new=1")}>adding a client</Link>. You can then raise an invoice, issue it and record payments as they arrive.</Notice>}
    {totals.map((total) => <section key={total.currency} aria-label={`${total.currency} receivables`}>
      {totals.length > 1 && <h2 className="section-heading">{total.currency}</h2>}
      <div className="organization-metrics">
        <Metric label="Outstanding" value={money(total.outstanding, total.currency)} note={`${summary.openInvoices} open invoice${summary.openInvoices === 1 ? "" : "s"}`} />
        <Metric label="Overdue" value={money(total.overdue, total.currency)} note={`${summary.overdueInvoices} past due date`} />
        <Metric label="Invoiced this month" value={money(total.invoicedThisMonth, total.currency)} note="Issued invoices dated this month" />
        <Metric label="Collected this month" value={money(total.collectedThisMonth, total.currency)} note="Payments received this month" />
      </div>
    </section>)}
    <div className="organization-metrics">
      <Metric label="Drafts" value={String(summary.draftInvoices)} note="Not yet issued" />
      <Metric label="Paid invoices" value={String(summary.paidInvoices)} note="Settled in full" />
      <Metric label="Active clients" value={String(summary.activeClients)} note="Available for billing" />
    </div>
    <h2 className="section-heading">Receivables aging</h2>
    <Table headers={["Currency", "Not yet due", "1–30 days", "31–60 days", "61–90 days", "Over 90 days"]}>
      {totals.map((total) => <tr key={total.currency}>
        <td><strong>{total.currency}</strong></td>
        {[total.aging.current, total.aging.days1To30, total.aging.days31To60, total.aging.days61To90, total.aging.over90].map((value, index) =>
          <td key={index} className={index > 0 && value > 0 ? "finance-late" : undefined}>{money(value, total.currency)}</td>)}
      </tr>)}
    </Table>
    <h2 className="section-heading">Needs attention</h2>
    {overdue.content.length === 0 && drafts.content.length === 0 ? <Empty>Nothing needs attention. Overdue invoices and unissued drafts appear here.</Empty> :
      <Table headers={["Invoice", "Client", "Due", "Balance", "Status", ""]}>
        {[...overdue.content, ...drafts.content].map((invoice) => <tr key={invoice.invoiceNumber}>
          <td><Link to={financePath(`/invoices/${invoice.invoiceNumber}`)}><strong>{invoice.invoiceNumber}</strong></Link></td>
          <td>{invoice.clientName}</td>
          <td>{formatDate(invoice.dueDate, defaults.locale)}</td>
          <td>{money(invoice.status === "DRAFT" ? invoice.total : invoice.balanceDue, invoice.currency)}</td>
          <td><InvoiceStatusBadges invoice={invoice} /></td>
          <td className="row-actions"><Link to={financePath(`/invoices/${invoice.invoiceNumber}`)}>{invoice.status === "DRAFT" ? "Review and issue" : "Record payment"}</Link></td>
        </tr>)}
      </Table>}
  </Page>;
}

const invoiceFilters: { key: string; label: string; status?: InvoiceStatus; overdue?: boolean }[] = [
  { key: "all", label: "All" }, { key: "draft", label: "Drafts", status: "DRAFT" }, { key: "issued", label: "Awaiting payment", status: "ISSUED" },
  { key: "partial", label: "Partially paid", status: "PARTIALLY_PAID" }, { key: "overdue", label: "Overdue", overdue: true },
  { key: "paid", label: "Paid", status: "PAID" }, { key: "void", label: "Void", status: "VOID" },
];

function Invoices() {
  const defaults = useOrganizationDefaults();
  const [params, setParams] = useSearchParams();
  const filter = invoiceFilters.find((item) => item.key === params.get("filter")) ?? invoiceFilters[0];
  const clientKey = params.get("client") ?? "";
  const page = Math.max(0, Number(params.get("page") ?? 0) || 0);
  const clients = useLoad(getClients);
  const { data, error } = useLoad(() => getInvoices({ status: filter.status, overdue: filter.overdue, clientKey: clientKey || undefined, page }), [filter.key, clientKey, page]);
  const update = (next: Record<string, string>) => {
    const values = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) { if (value) values.set(key, value); else values.delete(key); }
    if (!("page" in next)) values.delete("page");
    setParams(values);
  };
  return <Page title="Invoices" description="Draft, issue and track invoices. Issued invoices are locked; record payments against them as they arrive."
    actions={<Link className="button primary" to={financePath(`/invoices/new${clientKey ? `?client=${encodeURIComponent(clientKey)}` : ""}`)}>New invoice</Link>}>
    <div className="finance-filters">
      <nav className="finance-tabs" aria-label="Invoice status">
        {invoiceFilters.map((item) => <button key={item.key} type="button" className={item.key === filter.key ? "active" : undefined} aria-pressed={item.key === filter.key}
          onClick={() => update({ filter: item.key === "all" ? "" : item.key })}>{item.label}</button>)}
      </nav>
      <label>Client
        <select value={clientKey} onChange={(event) => update({ client: event.target.value })}>
          <option value="">All clients</option>
          {clients.data?.map((client) => <option key={client.clientKey} value={client.clientKey}>{client.displayName}</option>)}
        </select>
      </label>
    </div>
    {error && <Notice>{error}</Notice>}
    {!data && !error && <p>Loading invoices…</p>}
    {data && (data.content.length === 0 ? <Empty>{filter.key === "all" && !clientKey ? <>No invoices yet. <Link to={financePath("/invoices/new")}>Create your first invoice</Link>.</> : "No invoices match these filters."}</Empty> :
      <Table headers={["Invoice", "Client", "Invoice date", "Due", "Total", "Balance due", "Status"]}>
        {data.content.map((invoice) => <tr key={invoice.invoiceNumber}>
          <td><Link to={financePath(`/invoices/${invoice.invoiceNumber}`)}><strong>{invoice.invoiceNumber}</strong></Link></td>
          <td>{invoice.clientName}</td>
          <td>{formatDate(invoice.issueDate, defaults.locale)}</td>
          <td>{formatDate(invoice.dueDate, defaults.locale)}</td>
          <td>{formatMoney(invoice.total, invoice.currency, defaults.locale)}</td>
          <td>{invoice.status === "VOID" || invoice.status === "DRAFT" ? "—" : formatMoney(invoice.balanceDue, invoice.currency, defaults.locale)}</td>
          <td><InvoiceStatusBadges invoice={invoice} /></td>
        </tr>)}
      </Table>)}
    {data && data.totalPages > 1 && <Pager page={data.page} totalPages={data.totalPages} onPage={(next) => update({ page: next ? String(next) : "" })} />}
  </Page>;
}

function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage(page: number): void }) {
  return <div className="pagination">
    <span>Page {page + 1} of {totalPages}</span>
    <Button disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</Button>
    <Button disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)}>Next</Button>
  </div>;
}

function NewInvoice() {
  const [params] = useSearchParams();
  return <Page title="New invoice" description="Saved as a draft. You can review and edit it before issuing it to the client.">
    <InvoiceEditor initialClient={params.get("client") ?? ""} />
  </Page>;
}

interface LineDraft { description: string; quantity: string; unitPrice: string; taxRate: string }
const emptyLine = (): LineDraft => ({ description: "", quantity: "1", unitPrice: "", taxRate: "" });

function InvoiceEditor({ invoice, initialClient = "", onSaved, onCancel }: { invoice?: Invoice; initialClient?: string; onSaved?(invoice: Invoice): void; onCancel?(): void }) {
  const navigate = useNavigate();
  const defaults = useOrganizationDefaults();
  const clients = useLoad(getClients);
  const [clientKey, setClientKey] = useState(invoice?.clientKey ?? initialClient);
  const [issueDate, setIssueDate] = useState(invoice?.issueDate ?? localToday());
  const [dueDate, setDueDate] = useState(invoice?.dueDate ?? "");
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [lines, setLines] = useState<LineDraft[]>(invoice?.lines.map((line) => ({ description: line.description, quantity: String(line.quantity), unitPrice: String(line.unitPrice), taxRate: line.taxRate ? String(line.taxRate) : "" })) ?? [emptyLine()]);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const active = (clients.data ?? []).filter((client) => client.status === "ACTIVE" || client.clientKey === invoice?.clientKey);
  const client = active.find((item) => item.clientKey === clientKey);
  const currency = client?.currency ?? invoice?.currency ?? defaults.currency;
  const amounts = lines.map((line) => lineAmounts({ quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), taxRate: Number(line.taxRate) }));
  const subtotal = amounts.reduce((sum, value) => sum + value.subtotal, 0), tax = amounts.reduce((sum, value) => sum + value.tax, 0);
  const money = (value: number) => currency ? formatMoney(value, currency, defaults.locale) : value.toFixed(2);
  const setLine = (index: number, change: Partial<LineDraft>) => setLines((current) => current.map((line, position) => position === index ? { ...line, ...change } : line));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    const body = {
      clientKey, issueDate: issueDate || undefined, dueDate: dueDate || undefined, notes: notes.trim() || undefined,
      lines: lines.map((line) => ({ description: line.description.trim(), quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), taxRate: line.taxRate ? Number(line.taxRate) : 0 })),
    };
    void (invoice ? updateInvoice(invoice.invoiceNumber, body) : createInvoice(body))
      .then((saved) => { if (onSaved) onSaved(saved); else navigate(financePath(`/invoices/${saved.invoiceNumber}`)); })
      .catch((reason) => setError(message(reason, "Unable to save the invoice")))
      .finally(() => setBusy(false));
  };
  if (clients.error) return <Notice>{clients.error}</Notice>;
  if (!clients.data) return <p>Loading clients…</p>;
  if (active.length === 0) return <Notice tone="info">Add a client before creating an invoice. <Link to={financePath("/clients?new=1")}>Add client</Link></Notice>;
  return <form className="card finance-editor" onSubmit={submit} aria-label={invoice ? `Edit ${invoice.invoiceNumber}` : "New invoice"}>
    {error && <Notice>{error}</Notice>}
    <div className="form-grid">
      <label>Client
        <select required value={clientKey} onChange={(event) => setClientKey(event.target.value)}>
          <option value="" disabled>Choose a client</option>
          {active.map((item) => <option key={item.clientKey} value={item.clientKey}>{item.displayName} ({item.currency})</option>)}
        </select>
      </label>
      <label>Invoice date<input type="date" required value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></label>
      <label>Due date<input type="date" value={dueDate} min={issueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
    </div>
    {client && !dueDate && issueDate && <p className="snapshot-note">Due {formatDate(addDays(issueDate, client.paymentTermsDays), defaults.locale)} from {client.displayName}'s {client.paymentTermsDays}-day payment terms.</p>}
    <h3 className="section-heading">Line items</h3>
    <div className="table-wrap">
      <table className="finance-lines">
        <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Tax %</th><th>Amount</th><th><span className="overview-sr-only">Remove</span></th></tr></thead>
        <tbody>
          {lines.map((line, index) => <tr key={index}>
            <td><input aria-label={`Line ${index + 1} description`} required maxLength={300} value={line.description} onChange={(event) => setLine(index, { description: event.target.value })} placeholder="Service or item" /></td>
            <td><input aria-label={`Line ${index + 1} quantity`} required type="number" min="0.0001" step="any" value={line.quantity} onChange={(event) => setLine(index, { quantity: event.target.value })} /></td>
            <td><input aria-label={`Line ${index + 1} unit price`} required type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => setLine(index, { unitPrice: event.target.value })} /></td>
            <td><input aria-label={`Line ${index + 1} tax rate`} type="number" min="0" max="100" step="any" value={line.taxRate} onChange={(event) => setLine(index, { taxRate: event.target.value })} placeholder="0" /></td>
            <td className="finance-amount">{money(amounts[index].total)}</td>
            <td><Button type="button" size="sm" disabled={lines.length === 1} aria-label={`Remove line ${index + 1}`} onClick={() => setLines((current) => current.filter((_, position) => position !== index))}>Remove</Button></td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <Button type="button" size="sm" disabled={lines.length >= 100} onClick={() => setLines((current) => [...current, emptyLine()])}>Add line</Button>
    <dl className="pay-estimate" aria-label="Invoice totals">
      <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
      <div><dt>Tax</dt><dd>{money(tax)}</dd></div>
      <div className="net"><dt>Total</dt><dd>{money(subtotal + tax)}</dd></div>
    </dl>
    <label className="finance-notes">Notes for the client
      <textarea maxLength={2000} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Payment instructions, PO number…" />
    </label>
    <div className="form-actions">
      <Button variant="primary" disabled={busy || !clientKey}>{busy ? "Saving…" : invoice ? "Save draft" : "Save as draft"}</Button>
      {onCancel ? <Button type="button" onClick={onCancel}>Cancel</Button> : <Link className="button secondary" to={financePath("/invoices")}>Cancel</Link>}
    </div>
  </form>;
}

function InvoiceDetail() {
  const { invoiceNumber = "" } = useParams();
  const defaults = useOrganizationDefaults();
  const { data, error, reload } = useLoad(() => Promise.all([getInvoice(invoiceNumber), getInvoicePayments(invoiceNumber)]), [invoiceNumber]);
  const [mode, setMode] = useState<"view" | "edit" | "pay" | "void">("view");
  const [actionError, setActionError] = useState(""), [busy, setBusy] = useState(false);
  if (error) return <Page title={invoiceNumber}><Notice>{error}</Notice><Link to={financePath("/invoices")}>Back to invoices</Link></Page>;
  if (!data) return <Page title={invoiceNumber}><p>Loading invoice…</p></Page>;
  const [invoice, payments] = data as [Invoice, Payment[]];
  const money = (value: number) => formatMoney(value, invoice.currency, defaults.locale);
  const act = (action: () => Promise<unknown>, fallback: string) => {
    setBusy(true); setActionError("");
    void action().then(() => { setMode("view"); reload(); }).catch((reason) => setActionError(message(reason, fallback))).finally(() => setBusy(false));
  };
  const open = invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID";
  const actions = <div className="toolbar finance-no-print">
    {invoice.status === "DRAFT" && mode === "view" && <>
      <Button variant="primary" disabled={busy || invoice.total <= 0} onClick={() => confirm(`Issue ${invoice.invoiceNumber} for ${money(invoice.total)}? Issued invoices can no longer be edited.`) && act(() => issueInvoice(invoice.invoiceNumber), "Unable to issue the invoice")}>Issue invoice</Button>
      <Button disabled={busy} onClick={() => setMode("edit")}>Edit</Button>
    </>}
    {open && mode === "view" && <Button variant="primary" disabled={busy} onClick={() => setMode("pay")}>Record payment</Button>}
    {(invoice.status === "DRAFT" || (invoice.status === "ISSUED" && invoice.amountPaid === 0)) && mode === "view" && <Button variant="destructive" disabled={busy} onClick={() => setMode("void")}>Void</Button>}
    {invoice.status !== "DRAFT" && <Button onClick={() => window.print()}>Print</Button>}
  </div>;
  return <Page title={invoice.invoiceNumber} description={`${invoice.clientName} · ${humanize(invoice.status)}${invoice.overdue ? " · overdue" : ""}`} actions={actions}>
    <p className="finance-no-print"><Link to={financePath("/invoices")}>← All invoices</Link></p>
    {actionError && <Notice>{actionError}</Notice>}
    {invoice.status === "DRAFT" && mode === "view" && <Notice tone="info">This invoice is a draft. Review it, then issue it to lock the amounts and start tracking payment.</Notice>}
    {invoice.status === "VOID" && <Notice tone="info">Voided {formatDate(invoice.voidedAt, defaults.locale)}: {invoice.voidReason}</Notice>}
    {mode === "edit" && <InvoiceEditor invoice={invoice} onSaved={() => { setMode("view"); reload(); }} onCancel={() => setMode("view")} />}
    {mode === "pay" && <PaymentForm invoice={invoice} busy={busy} onCancel={() => setMode("view")}
      onSubmit={(body) => act(() => recordPayment(invoice.invoiceNumber, body), "Unable to record the payment")} />}
    {mode === "void" && <VoidForm busy={busy} onCancel={() => setMode("view")} onSubmit={(reason) => act(() => voidInvoice(invoice.invoiceNumber, reason), "Unable to void the invoice")} />}
    {mode !== "edit" && <article className="card finance-document" aria-label={`Invoice ${invoice.invoiceNumber}`}>
      <div className="finance-document-header">
        <div>
          <span className="eyebrow">Bill to</span>
          <h3>{invoice.clientName}</h3>
          {invoice.clientBillingAddress && <p className="finance-address">{invoice.clientBillingAddress}</p>}
          {invoice.clientTaxId && <p>Tax ID: {invoice.clientTaxId}</p>}
          {invoice.clientEmail && <p>{invoice.clientEmail}</p>}
        </div>
        <dl className="detail-list">
          <div><dt>Invoice</dt><dd><strong>{invoice.invoiceNumber}</strong> <InvoiceStatusBadges invoice={invoice} /></dd></div>
          <div><dt>Invoice date</dt><dd>{formatDate(invoice.issueDate, defaults.locale)}</dd></div>
          <div><dt>Due date</dt><dd>{formatDate(invoice.dueDate, defaults.locale)}</dd></div>
          <div><dt>Currency</dt><dd>{invoice.currency}</dd></div>
        </dl>
      </div>
      <Table headers={["#", "Description", "Qty", "Unit price", "Tax", "Amount"]}>
        {invoice.lines.map((line) => <tr key={line.lineNumber}>
          <td>{line.lineNumber}</td>
          <td>{line.description}</td>
          <td>{line.quantity}</td>
          <td>{money(line.unitPrice)}</td>
          <td>{line.taxRate ? `${line.taxRate}% · ${money(line.taxAmount)}` : "—"}</td>
          <td className="finance-amount">{money(line.total)}</td>
        </tr>)}
      </Table>
      <dl className="pay-estimate" aria-label="Invoice totals">
        <div><dt>Subtotal</dt><dd>{money(invoice.subtotal)}</dd></div>
        <div><dt>Tax</dt><dd>{money(invoice.taxTotal)}</dd></div>
        <div><dt>Total</dt><dd>{money(invoice.total)}</dd></div>
        {invoice.status !== "DRAFT" && invoice.status !== "VOID" && <>
          <div><dt>Paid</dt><dd>{money(invoice.amountPaid)}</dd></div>
          <div className="net"><dt>Balance due</dt><dd>{money(invoice.balanceDue)}</dd></div>
        </>}
      </dl>
      {invoice.notes && <p className="finance-address"><strong>Notes</strong><br />{invoice.notes}</p>}
    </article>}
    {invoice.status !== "DRAFT" && invoice.status !== "VOID" && <section aria-labelledby="invoice-payments-heading">
      <h2 id="invoice-payments-heading" className="section-heading">Payments received</h2>
      {payments.length === 0 ? <Empty>No payments recorded yet.</Empty> :
        <Table headers={["Receipt", "Date", "Method", "Reference", "Amount"]}>
          {payments.map((payment) => <tr key={payment.receiptNumber}>
            <td>{payment.receiptNumber}</td>
            <td>{formatDate(payment.paymentDate, defaults.locale)}</td>
            <td>{humanize(payment.method)}</td>
            <td>{payment.reference || "—"}</td>
            <td className="finance-amount">{money(payment.amount)}</td>
          </tr>)}
        </Table>}
    </section>}
  </Page>;
}

function PaymentForm({ invoice, busy, onSubmit, onCancel }: { invoice: Invoice; busy: boolean; onSubmit(body: { amount: number; paymentDate: string; method: PaymentMethod; reference?: string; notes?: string }): void; onCancel(): void }) {
  const today = localToday();
  return <form className="card" aria-label="Record payment" onSubmit={(event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    onSubmit({ amount: Number(values.amount), paymentDate: String(values.paymentDate), method: String(values.method) as PaymentMethod,
      reference: String(values.reference || "").trim() || undefined, notes: String(values.notes || "").trim() || undefined });
  }}>
    <h3>Record payment</h3>
    <div className="form-grid">
      <label>Amount ({invoice.currency})<input name="amount" type="number" required min="0.01" max={invoice.balanceDue} step="0.01" defaultValue={invoice.balanceDue} /></label>
      <label>Payment date<input name="paymentDate" type="date" required min={invoice.issueDate} max={today} defaultValue={today < invoice.issueDate ? invoice.issueDate : today} /></label>
      <label>Method
        <select name="method" defaultValue="BANK_TRANSFER">{paymentMethods.map((method) => <option key={method} value={method}>{humanize(method)}</option>)}</select>
      </label>
      <label>Reference<input name="reference" maxLength={64} placeholder="UTR, cheque or transaction ID" /></label>
      <label className="form-wide">Notes<input name="notes" maxLength={500} /></label>
    </div>
    <div className="form-actions">
      <Button variant="primary" disabled={busy}>{busy ? "Saving…" : "Record payment"}</Button>
      <Button type="button" onClick={onCancel}>Cancel</Button>
    </div>
  </form>;
}

function VoidForm({ busy, onSubmit, onCancel }: { busy: boolean; onSubmit(reason: string): void; onCancel(): void }) {
  return <form className="card" aria-label="Void invoice" onSubmit={(event) => { event.preventDefault(); onSubmit(String(new FormData(event.currentTarget).get("reason")).trim()); }}>
    <h3>Void invoice</h3>
    <p className="snapshot-note">A voided invoice keeps its number for your records but no longer counts towards receivables. This cannot be undone.</p>
    <div className="form-grid"><label className="form-wide">Reason<input name="reason" required maxLength={300} placeholder="For example: raised in error" /></label></div>
    <div className="form-actions">
      <Button variant="destructive" disabled={busy}>{busy ? "Voiding…" : "Void invoice"}</Button>
      <Button type="button" onClick={onCancel}>Keep invoice</Button>
    </div>
  </form>;
}

function Clients() {
  const defaults = useOrganizationDefaults();
  const [params, setParams] = useSearchParams();
  const { data, error, reload } = useLoad(getClients);
  const [editing, setEditing] = useState<BillingClient | null>(null);
  const [actionError, setActionError] = useState("");
  const creating = params.get("new") === "1";
  const closeForm = () => { setEditing(null); if (creating) setParams({}); };
  const toggleArchive = (client: BillingClient) => {
    setActionError("");
    void updateClient(client.clientKey, { status: client.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" }).then(reload)
      .catch((reason) => setActionError(message(reason, "Unable to update the client")));
  };
  return <Page title="Clients" description="The companies and people you bill. Each client has a billing currency and default payment terms."
    actions={!creating && !editing ? <Button variant="primary" onClick={() => setParams({ new: "1" })}>New client</Button> : undefined}>
    {(creating || editing) && <ClientForm key={editing?.clientKey ?? "new"} client={editing ?? undefined} defaultCurrency={defaults.currency}
      onCancel={closeForm} onSaved={() => { closeForm(); reload(); }} />}
    {(error || actionError) && <Notice>{error || actionError}</Notice>}
    {!data && !error && <p>Loading clients…</p>}
    {data && (data.length === 0 ? (!creating && <Empty>No clients yet. Add a client to start invoicing.</Empty>) :
      <Table headers={["Client", "Contact", "Currency", "Terms", "Outstanding", "Status", ""]}>
        {data.map((client) => <tr key={client.clientKey} className={editing?.clientKey === client.clientKey ? "selected-row" : undefined}>
          <td><strong>{client.displayName}</strong><small className="cell-note">{client.clientKey}</small></td>
          <td>{client.email || client.phone || "—"}</td>
          <td>{client.currency}</td>
          <td>{client.paymentTermsDays === 0 ? "Due on receipt" : `${client.paymentTermsDays} days`}</td>
          <td>{client.openInvoices ? <Link to={financePath(`/invoices?client=${encodeURIComponent(client.clientKey)}`)}>{formatMoney(client.outstandingAmount, client.currency, defaults.locale)} · {client.openInvoices} open</Link> : "—"}</td>
          <td><StatusBadge status={client.status} /></td>
          <td className="row-actions">
            {client.status === "ACTIVE" && <Link to={financePath(`/invoices/new?client=${encodeURIComponent(client.clientKey)}`)}>New invoice</Link>}
            <button type="button" className="link-button" onClick={() => { setParams({}); setEditing(client); }}>Edit</button>
            <button type="button" className="link-button" onClick={() => toggleArchive(client)}>{client.status === "ACTIVE" ? "Archive" : "Restore"}</button>
          </td>
        </tr>)}
      </Table>)}
  </Page>;
}

function ClientForm({ client, defaultCurrency, onSaved, onCancel }: { client?: BillingClient; defaultCurrency: string; onSaved(): void; onCancel(): void }) {
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const field = (label: ReactNode, input: ReactNode, wide = false) => <label className={wide ? "form-wide" : undefined}>{label}{input}</label>;
  return <form className="card" aria-label={client ? `Edit ${client.displayName}` : "New client"} onSubmit={(event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const body = {
      displayName: values.displayName.trim(), email: values.email.trim(), phone: values.phone.trim(), billingAddress: values.billingAddress.trim(),
      taxId: values.taxId.trim(), currency: values.currency.trim().toUpperCase(), paymentTermsDays: Number(values.paymentTermsDays),
    };
    setBusy(true); setError("");
    void (client ? updateClient(client.clientKey, body) : createClient({ ...body, email: body.email || undefined }))
      .then(onSaved).catch((reason) => setError(message(reason, "Unable to save the client"))).finally(() => setBusy(false));
  }}>
    <h3>{client ? `Edit ${client.displayName}` : "New client"}</h3>
    {error && <Notice>{error}</Notice>}
    <div className="form-grid">
      {field("Client name", <input name="displayName" required maxLength={160} defaultValue={client?.displayName} />)}
      {field("Billing email", <input name="email" type="email" maxLength={254} defaultValue={client?.email ?? ""} />)}
      {field("Phone", <input name="phone" maxLength={32} defaultValue={client?.phone ?? ""} />)}
      {field("Tax ID (GSTIN / VAT)", <input name="taxId" maxLength={32} defaultValue={client?.taxId ?? ""} />)}
      {field("Billing currency", <input name="currency" required pattern="[A-Za-z]{3}" maxLength={3} defaultValue={client?.currency ?? defaultCurrency} placeholder="e.g. INR" />)}
      {field("Payment terms (days)", <input name="paymentTermsDays" type="number" required min={0} max={365} defaultValue={client?.paymentTermsDays ?? 30} />)}
      {field("Billing address", <textarea name="billingAddress" rows={3} maxLength={500} defaultValue={client?.billingAddress ?? ""} />, true)}
    </div>
    {client && <p className="snapshot-note">Currency changes apply to new invoices. Existing invoices keep the currency they were raised in.</p>}
    <div className="form-actions">
      <Button variant="primary" disabled={busy}>{busy ? "Saving…" : client ? "Save client" : "Add client"}</Button>
      <Button type="button" onClick={onCancel}>Cancel</Button>
    </div>
  </form>;
}

function Payments() {
  const defaults = useOrganizationDefaults();
  const [page, setPage] = useState(0);
  const { data, error } = useLoad(() => getPayments(page), [page]);
  return <Page title="Payments" description="Every payment received against your invoices, newest first. Record new payments from an issued invoice.">
    {error && <Notice>{error}</Notice>}
    {!data && !error && <p>Loading payments…</p>}
    {data && (data.content.length === 0 ? <Empty>No payments recorded yet. Open an issued invoice to record a payment.</Empty> :
      <Table headers={["Receipt", "Date", "Client", "Invoice", "Method", "Reference", "Amount"]}>
        {data.content.map((payment) => <tr key={payment.receiptNumber}>
          <td><strong>{payment.receiptNumber}</strong></td>
          <td>{formatDate(payment.paymentDate, defaults.locale)}</td>
          <td>{payment.clientName}</td>
          <td><Link to={financePath(`/invoices/${payment.invoiceNumber}`)}>{payment.invoiceNumber}</Link></td>
          <td>{humanize(payment.method)}</td>
          <td>{payment.reference || "—"}</td>
          <td className="finance-amount">{formatMoney(payment.amount, payment.currency, defaults.locale)}</td>
        </tr>)}
      </Table>)}
    {data && data.totalPages > 1 && <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />}
  </Page>;
}
