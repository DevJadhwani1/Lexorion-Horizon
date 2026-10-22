import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ApiError, type Page as ResultPage } from "../../api/types";
import { appPath } from "../../app/hostRouting";
import { useAuth } from "../../auth/AuthProvider";
import { Badge, StatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Dropdown } from "../../components/ui/Dropdown";
import { Empty, Notice, Page } from "../../components/ui/Page";
import {
  getBillingSummary, getClients, getInvoice, getInvoicePayments, getInvoices, getNextNumber, getPayments, getTemplates,
  issueInvoice, paymentMethods, recordPayment, voidInvoice,
  type BillingSummary, type Invoice, type InvoiceStatus, type InvoiceSummary, type InvoiceTemplate, type Payment, type PaymentMethod,
} from "../../features/finance/financeApi";
import { useOrganizationDefaults } from "../../features/organization/useOrganizationDefaults";
import { formatDate, humanize } from "../../lib/format";
import { formatBillingMoney } from "../../features/finance/billingData";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { Table } from "../admin/AdminPage";
import { Pagination } from "../workforce/WorkforcePage";
import { InvoiceDocument } from "./InvoiceDocument";
import { useConfirm } from "../../components/ui/ConfirmDialog";

const PAGE_SIZE = 20;
const financePath = (path = "") => appPath(`/app/finance${path}`);
const invoicePath = (invoice: { reference: string }) => financePath(`/invoices/${encodeURIComponent(invoice.reference)}`);
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

export function FinancePage({ sectionKey }: { sectionKey: "overview" | "invoices" | "invoice" | "payments" }) {
  const { workspace } = useWorkspace();
  if (!workspace?.products.some((product) => product.key === "finance"))
    return <Page title="Finance"><Notice tone="info">Select a workspace with Finance enabled to manage billing.</Notice></Page>;
  if (sectionKey === "invoices") return <Invoices key={workspace.key} />;
  if (sectionKey === "invoice") return <InvoiceDetail key={workspace.key} />;
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

/** Invoice cell: the number links to the invoice once issued; a draft links as "Draft" with its reference underneath. */
function InvoiceLink({ invoice }: { invoice: Pick<InvoiceSummary, "invoiceNumber" | "reference"> }) {
  return <><Link to={invoicePath(invoice)}>{invoice.invoiceNumber ?? "Draft"}</Link>{!invoice.invoiceNumber && <small className="cell-note">{invoice.reference}</small>}</>;
}

function Overview() {
  const defaults = useOrganizationDefaults();
  const { workspace } = useWorkspace();
  const { data, error } = useLoad(() => Promise.all([getBillingSummary(), getInvoices({ overdue: true, size: 5, page: 0 }), getInvoices({ status: "DRAFT", size: 5, page: 0 }), getTemplates()]));
  if (error) return <Page title="Finance"><Notice>{error}</Notice></Page>;
  if (!data) return <Page title="Finance"><p>Loading billing overview…</p></Page>;
  const [summary, overdue, drafts, templates] = data as [BillingSummary, ResultPage<InvoiceSummary>, ResultPage<InvoiceSummary>, InvoiceTemplate[]];
  const money = (value: number, currency: string) => formatBillingMoney(value, currency, defaults.locale);
  const totals = summary.totals.length ? summary.totals : [{ currency: defaults.currency || "INR", outstanding: 0, overdue: 0, invoicedThisMonth: 0, collectedThisMonth: 0, aging: { current: 0, days1To30: 0, days31To60: 0, days61To90: 0, over90: 0 } }];
  const actions = <div className="toolbar">
    <Link className="button primary" to={financePath("/invoices/new")}>New invoice</Link>
    <Link className="button secondary" to={financePath("/clients/new")}>New client</Link>
  </div>;
  return <Page title="Finance" description={`Billing and collections for ${workspace?.displayName ?? "this workspace"}, as of ${formatDate(summary.asOf, defaults.locale)}.`} actions={actions}>
    {templates.length === 0 && <Notice tone="info">Your invoices use the standard format. <Link to={appPath("/app/finance/templates/new")}>Design your own invoice template</Link> with your logo, bank details, numbering and industry fields.</Notice>}
    {summary.activeClients === 0 && <Notice tone="info">Start by <Link to={financePath("/clients/new")}>adding a client</Link>. You can then raise an invoice, issue it and record payments as they arrive.</Notice>}
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
        {[...overdue.content, ...drafts.content].map((invoice) => <tr key={invoice.reference}>
          <td><InvoiceLink invoice={invoice} /></td>
          <td>{invoice.clientName}</td>
          <td>{formatDate(invoice.dueDate, defaults.locale)}</td>
          <td>{money(invoice.status === "DRAFT" ? invoice.total : invoice.balanceDue, invoice.currency)}</td>
          <td><InvoiceStatusBadges invoice={invoice} /></td>
          <td className="row-actions"><Link to={invoicePath(invoice)}>{invoice.status === "DRAFT" ? "Review and issue" : "Record payment"}</Link></td>
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
  const clientKey = params.get("client") ?? "", search = params.get("q") ?? "";
  const page = Math.max(0, Number(params.get("page") ?? 0) || 0);
  const [draft, setDraft] = useState(search);
  const clients = useLoad(getClients);
  const { data, error } = useLoad(() => getInvoices({ status: filter.status, overdue: filter.overdue, clientKey: clientKey || undefined, search: search || undefined, page, size: PAGE_SIZE }), [filter.key, clientKey, search, page]);
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
  const filtered = filter.key !== "all" || Boolean(clientKey || search);
  const clear = () => { setDraft(""); setParams(new URLSearchParams(), { replace: true }); };
  return <Page title="Invoices" description="Draft, issue and track invoices. Issued invoices are locked; record payments against them as they arrive."
    actions={<Link className="button primary" to={financePath(`/invoices/new${clientKey ? `?client=${encodeURIComponent(clientKey)}` : ""}`)}>New invoice</Link>}>
    <form className="toolbar filter-bar directory-filters" role="search" onSubmit={(event) => { event.preventDefault(); update({ q: draft.trim() }); }}>
      <label>Search invoices<input type="search" placeholder="Invoice number, reference or client" value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
      <Dropdown label="Status" value={filter.key} onChange={(next) => update({ filter: next === "all" ? "" : next })}
        options={invoiceFilters.map((item) => ({ value: item.key, label: item.key === "all" ? "All statuses" : item.label }))} />
      <Dropdown label="Client" value={clientKey} searchable onChange={(next) => update({ client: next })}
        options={[{ value: "", label: "All clients" }, ...(clients.data ?? []).map((client) => ({ value: client.clientKey, label: client.displayName }))]} />
      {filtered && <Button type="button" onClick={clear}>Clear filters</Button>}
    </form>
    {error && <Notice>{error}</Notice>}
    {!data && !error ? <p role="status">Loading invoices…</p> : data && (data.content.length ? <>
      <Table headers={["Invoice", "Client", "Invoice date", "Due", "Total", "Balance due", "Status"]}>
        {data.content.map((invoice) => <tr key={invoice.reference}>
          <td><InvoiceLink invoice={invoice} /></td>
          <td><Link to={appPath(`/app/finance/clients/${encodeURIComponent(invoice.clientKey)}`)}>{invoice.clientName}</Link></td>
          <td>{formatDate(invoice.issueDate, defaults.locale)}</td>
          <td>{formatDate(invoice.dueDate, defaults.locale)}</td>
          <td>{formatBillingMoney(invoice.total, invoice.currency, defaults.locale)}</td>
          <td>{invoice.status === "VOID" || invoice.status === "DRAFT" ? "—" : formatBillingMoney(invoice.balanceDue, invoice.currency, defaults.locale)}</td>
          <td><InvoiceStatusBadges invoice={invoice} /></td>
        </tr>)}
      </Table>
      <Pagination page={data.page} totalPages={data.totalPages} total={data.totalElements} size={PAGE_SIZE} onPage={(next) => update({ page: next ? String(next) : "" })} />
    </> : filtered
      ? <Empty>No invoices match these filters. <button type="button" className="link-button" onClick={clear}>Clear filters</button></Empty>
      : <Empty><strong>No invoices yet.</strong><br />Raise your first invoice for a client. <Link to={financePath("/invoices/new")}>Create invoice</Link></Empty>)}
  </Page>;
}

function InvoiceDetail() {
  const { reference = "" } = useParams();
  const defaults = useOrganizationDefaults();
  const organizationName = useAuth().organization?.organizationName;
  const [ask, confirmDialog] = useConfirm();
  const { data, error, reload } = useLoad(() => Promise.all([getInvoice(reference), getInvoicePayments(reference)]), [reference]);
  const navigate = useNavigate();
  const [mode, setMode] = useState<"view" | "pay" | "void">("view");
  const [nextNumber, setNextNumber] = useState("");
  const [actionError, setActionError] = useState(""), [busy, setBusy] = useState(false);
  const invoice = data?.[0];
  const draftTemplate = invoice && !invoice.invoiceNumber && invoice.status === "DRAFT" ? invoice.template.templateKey : null;
  useEffect(() => {
    setNextNumber("");
    if (!invoice || !draftTemplate) return;
    getNextNumber(draftTemplate, invoice.issueDate).then((result) => setNextNumber(result.number)).catch(() => undefined);
  }, [draftTemplate, invoice?.issueDate]);
  if (error) return <Page title="Invoice"><Notice>{error}</Notice><Link to={financePath("/invoices")}>Back to invoices</Link></Page>;
  if (!data || !invoice) return <Page title="Invoice"><p>Loading invoice…</p></Page>;
  const payments = data[1] as Payment[];
  const money = (value: number) => formatBillingMoney(value, invoice.currency, invoice.currency === "INR" ? "en-IN" : defaults.locale);
  const act = (action: () => Promise<unknown>, fallback: string) => {
    setBusy(true); setActionError("");
    void action().then(() => { setMode("view"); reload(); }).catch((reason) => setActionError(message(reason, fallback))).finally(() => setBusy(false));
  };
  const open = invoice.status === "ISSUED" || invoice.status === "PARTIALLY_PAID";
  const title = invoice.invoiceNumber ?? `Draft ${invoice.reference}`;
  const actions = <div className="toolbar">
    {invoice.status === "DRAFT" && mode === "view" && <>
      <Button variant="primary" disabled={busy || invoice.total <= 0} onClick={async () => await ask({ title: `Issue this invoice for ${money(invoice.total)}?`, body: `${nextNumber ? `It will be numbered ${nextNumber}. ` : ""}Issued invoices can no longer be edited.`, confirmLabel: "Issue invoice" }) && act(() => issueInvoice(invoice.reference), "Unable to issue the invoice")}>Issue invoice</Button>
      <Button disabled={busy} onClick={() => navigate(financePath(`/invoices/${encodeURIComponent(invoice.reference)}/edit`))}>Edit</Button>
    </>}
    {open && mode === "view" && <Button variant="primary" disabled={busy} onClick={() => setMode("pay")}>Record payment</Button>}
    {(invoice.status === "DRAFT" || (invoice.status === "ISSUED" && invoice.amountPaid === 0)) && mode === "view" && <Button variant="destructive" disabled={busy} onClick={() => setMode("void")}>Void</Button>}
    <Button onClick={() => window.print()}>Print / PDF</Button>
  </div>;
  return <Page title={title} description={`${invoice.clientName} · ${humanize(invoice.status)}${invoice.overdue ? " · overdue" : ""} · ${invoice.template.name} template`} actions={actions}>
    {confirmDialog}
    <p><Link to={financePath("/invoices")}>← All invoices</Link></p>
    {actionError && <Notice>{actionError}</Notice>}
    {invoice.status === "DRAFT" && mode === "view" && <Notice tone="info">
      This is a draft{nextNumber ? <>. It will be numbered <strong>{nextNumber}</strong> when issued</> : ""}. Issuing locks the amounts and keeps this exact layout, even if the template changes later.
    </Notice>}
    {invoice.status === "VOID" && <Notice tone="info">Voided {formatDate(invoice.voidedAt, defaults.locale)}: {invoice.voidReason}</Notice>}
    {mode === "pay" && <PaymentForm invoice={invoice} busy={busy} onCancel={() => setMode("view")}
      onSubmit={(body) => act(() => recordPayment(invoice.reference, body), "Unable to record the payment")} />}
    {mode === "void" && <VoidForm busy={busy} onCancel={() => setMode("view")} onSubmit={(reason) => act(() => voidInvoice(invoice.reference, reason), "Unable to void the invoice")} />}
    {<div className="invoice-doc-scroll invoice-print-area">
      <InvoiceDocument template={invoice.template} fallbackSellerName={organizationName} locale={defaults.locale}
        data={{ ...invoice, number: invoice.invoiceNumber, lines: invoice.lines }} />
    </div>}
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
      <Dropdown label="Method" name="method" required defaultValue="BANK_TRANSFER" options={paymentMethods.map((method) => ({ value: method, label: humanize(method) }))} />
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
    <p className="snapshot-note">A voided invoice stays in your records but no longer counts towards receivables. This cannot be undone.</p>
    <div className="form-grid"><label className="form-wide">Reason<input name="reason" required maxLength={300} placeholder="For example: raised in error" /></label></div>
    <div className="form-actions">
      <Button variant="destructive" disabled={busy}>{busy ? "Voiding…" : "Void invoice"}</Button>
      <Button type="button" onClick={onCancel}>Keep invoice</Button>
    </div>
  </form>;
}

function Payments() {
  const defaults = useOrganizationDefaults();
  const [page, setPage] = useState(0);
  const { data, error } = useLoad(() => getPayments(page, PAGE_SIZE), [page]);
  return <Page title="Payments" description="Every payment received against your invoices, newest first. Record new payments from an issued invoice.">
    {error && <Notice>{error}</Notice>}
    {!data && !error && <p>Loading payments…</p>}
    {data && (data.content.length === 0 ? <Empty>No payments recorded yet. Open an issued invoice to record a payment.</Empty> :
      <Table headers={["Receipt", "Date", "Client", "Invoice", "Method", "Reference", "Amount"]}>
        {data.content.map((payment) => <tr key={payment.receiptNumber}>
          <td><strong>{payment.receiptNumber}</strong></td>
          <td>{formatDate(payment.paymentDate, defaults.locale)}</td>
          <td>{payment.clientName}</td>
          <td><Link to={financePath(`/invoices/${encodeURIComponent(payment.invoiceReference)}`)}>{payment.invoiceNumber ?? payment.invoiceReference}</Link></td>
          <td>{humanize(payment.method)}</td>
          <td>{payment.reference || "—"}</td>
          <td className="finance-amount">{formatBillingMoney(payment.amount, payment.currency, defaults.locale)}</td>
        </tr>)}
      </Table>)}
    {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.totalElements} size={PAGE_SIZE} onPage={setPage} />}
  </Page>;
}
