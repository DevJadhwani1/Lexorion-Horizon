import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/types";
import { appPath } from "../../app/hostRouting";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Dropdown } from "../../components/ui/Dropdown";
import { Empty, Notice, Page } from "../../components/ui/Page";
import { formatBillingMoney } from "../../features/finance/billingData";
import {
  downloadCsv, getBookSettings, getClients, getFiscalYears, getJournal, getSalesRegister, getStatement, getYearSummary, ledgerAccounts, updateBookSettings, voucherLabels,
  type BillingClient, type BookSettings, type FiscalYearOption, type Journal, type SalesRegister, type Statement, type YearSummary,
} from "../../features/finance/financeApi";
import { useOrganizationDefaults } from "../../features/organization/useOrganizationDefaults";
import { formatDate } from "../../lib/format";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { Table } from "../admin/AdminPage";
import { Pagination } from "../workforce/WorkforcePage";

type Section = "summary" | "sales-register" | "journal" | "settings";
const booksPath = (path = "") => appPath(`/app/finance/books${path}`);
const message = (reason: unknown, fallback: string) => reason instanceof ApiError || reason instanceof Error ? reason.message : fallback;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthName = (month: string) => { const [year, number] = month.split("-").map(Number); return `${MONTHS[number - 1].slice(0, 3)} ${year}`; };
const signed = (value: number) => value < 0 ? "finance-late" : undefined;

export function BooksPage({ section }: { section: Section }) {
  const key = useWorkspace().workspace?.key;
  return <Books key={key} section={section} />;
}

function Books({ section }: { section: Section }) {
  const [params, setParams] = useSearchParams();
  const [years, setYears] = useState<FiscalYearOption[] | null>(null), [error, setError] = useState("");
  useEffect(() => { getFiscalYears().then(setYears).catch((reason) => setError(message(reason, "Unable to load financial years"))); }, []);
  const fy = params.get("fy") ?? years?.find((year) => year.current)?.label ?? "";
  const year = years?.find((item) => item.label === fy);
  const tab = (path: string, label: string) => <NavLink to={`${booksPath(path)}${fy ? `?fy=${fy}` : ""}`} end className={({ isActive }) => `admin-tab-link${isActive ? " active" : ""}`}>{label}</NavLink>;
  const titles: Record<Section, string> = { summary: "Books", "sales-register": "Sales register", journal: "Journal", settings: "Books settings" };
  return <Page title={titles[section]} description={year ? `Financial year ${year.label}: ${formatDate(year.start)} to ${formatDate(year.end)}. Figures come from the ledger that issued invoices, receipts and voids post to.` : "Your billing ledger by financial year and month."}
    actions={section !== "settings" && years ? <Dropdown label="Financial year" value={fy} onChange={(next) => setParams((previous) => { const value = new URLSearchParams(previous); value.set("fy", next); value.delete("month"); value.delete("page"); return value; })}
      options={years.map((item) => ({ value: item.label, label: `FY ${item.label}`, subLabel: item.current ? "Current" : undefined }))} /> : undefined}>
    <nav className="settings-section-nav" aria-label="Books sections">
      {tab("", "Month-wise summary")}{tab("/sales-register", "Sales register")}{tab("/journal", "Journal")}{tab("/settings", "Settings")}
    </nav>
    {error && <Notice>{error}</Notice>}
    {section === "settings" ? <BookSettingsForm /> : !years ? <p role="status">Loading financial years…</p>
      : section === "summary" ? <MonthWise key={fy} fy={fy} />
        : section === "sales-register" ? <Register key={fy} fy={fy} months={year ? monthsOf(year) : []} />
          : <JournalView key={fy} fy={fy} months={year ? monthsOf(year) : []} />}
  </Page>;
}

function monthsOf(year: FiscalYearOption): string[] {
  const months: string[] = [];
  const [startYear, startMonth] = year.start.split("-").map(Number);
  for (let index = 0; index < 12; index++) {
    const month = (startMonth - 1 + index) % 12 + 1, yearNumber = startYear + Math.floor((startMonth - 1 + index) / 12);
    months.push(`${yearNumber}-${String(month).padStart(2, "0")}`);
  }
  return months;
}

function useData<T>(load: () => Promise<T>, dependencies: unknown[]) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    setError("");
    load().then((value) => { if (current) setData(value); }).catch((reason) => { if (current) setError(message(reason, "Unable to load the books")); });
    return () => { current = false; };
  }, dependencies);
  return { data, error };
}

function MonthWise({ fy }: { fy: string }) {
  const defaults = useOrganizationDefaults();
  const { data, error } = useData<YearSummary>(() => getYearSummary(fy || undefined), [fy]);
  if (error) return <Notice>{error}</Notice>;
  if (!data) return <p role="status">Loading the month-wise summary…</p>;
  if (!data.currencies.length) return <Empty><strong>Nothing posted in FY {data.fiscalYear}.</strong><br />Invoices post to the books when they are issued, and payments when they are recorded. <Link to={appPath("/app/finance/invoices/new")}>Create an invoice</Link></Empty>;
  return <>
    {data.booksLockedUntil && <Notice tone="info">Books are locked up to {formatDate(data.booksLockedUntil, defaults.locale)}. Nothing can be issued, received or voided on or before that date.</Notice>}
    {data.basis && <p className="snapshot-note">{data.basis}</p>}
    {data.currencies.map((currency) => {
      const money = (value: number) => formatBillingMoney(value, currency.currency, defaults.locale);
      const tax = (row: { cgst: number; sgst: number; igst: number; otherTax: number }) => row.cgst + row.sgst + row.igst + row.otherTax;
      const gst = currency.total.cgst || currency.total.sgst || currency.total.igst;
      const exportCsv = () => downloadCsv(`books-${data.fiscalYear}-${currency.currency}.csv`, [
        ["Month", "Invoices", "Voided", "Taxable", "CGST", "SGST", "IGST", "Other tax", "Invoiced", "Collected", "Receivable at month end"],
        ["Opening balance", "", "", "", "", "", "", "", "", "", currency.openingReceivables],
        ...currency.months.map((row) => [monthName(row.month), row.invoicesIssued, row.invoicesVoided, row.taxable, row.cgst, row.sgst, row.igst, row.otherTax, row.invoiced, row.collected, row.closingReceivables]),
        ["Total", currency.total.invoicesIssued, currency.total.invoicesVoided, currency.total.taxable, currency.total.cgst, currency.total.sgst, currency.total.igst, currency.total.otherTax, currency.total.invoiced, currency.total.collected, currency.closingReceivables],
      ]);
      return <section key={currency.currency} className="card" aria-label={`${currency.currency} month-wise summary`}>
        <div className="card-heading">
          <h3>{data.currencies.length > 1 ? `${currency.currency} · ` : ""}FY {data.fiscalYear} month by month</h3>
          <Button size="sm" onClick={exportCsv}>Export CSV</Button>
        </div>
        <div className="organization-metrics">
          <article><span>Opening receivables</span><strong>{money(currency.openingReceivables)}</strong><small>Brought forward from earlier years</small></article>
          <article><span>Invoiced</span><strong>{money(currency.total.invoiced)}</strong><small>{currency.total.invoicesIssued} invoices{currency.total.invoicesVoided ? `, ${currency.total.invoicesVoided} voided` : ""}</small></article>
          <article><span>{gst ? "GST collected on sales" : "Tax on sales"}</span><strong>{money(tax(currency.total))}</strong><small>Taxable value {money(currency.total.taxable)}</small></article>
          <article><span>Collected</span><strong>{money(currency.total.collected)}</strong><small>Allocated receipts, by receipt date</small></article>
          <article><span>Closing receivables</span><strong>{money(currency.closingReceivables)}</strong><small>Carried forward</small></article>
        </div>
        {currency.aging && <p className="snapshot-note">Outstanding aging: not yet due {money(currency.aging.current)}, 1–30 days {money(currency.aging.days1To30)}, 31–60 days {money(currency.aging.days31To60)}, 61–90 days {money(currency.aging.days61To90)}, over 90 days {money(currency.aging.over90)}.</p>}
        <Table headers={["Month", "Invoices", "Taxable value", ...(gst ? ["CGST", "SGST", "IGST"] : ["Tax"]), "Invoiced", "Collected", "Receivable at month end"]}>
          <tr className="books-opening"><td>Opening balance</td><td colSpan={gst ? 7 : 5}></td><td className="finance-amount">{money(currency.openingReceivables)}</td></tr>
          {currency.months.map((row) => <tr key={row.month}>
            <td>{row.invoicesIssued || row.invoicesVoided || row.collected ? <Link to={`${booksPath("/sales-register")}?fy=${data.fiscalYear}&month=${row.month}`}>{monthName(row.month)}</Link> : monthName(row.month)}</td>
            <td>{row.invoicesIssued || "—"}{row.invoicesVoided ? <small className="cell-note">{row.invoicesVoided} voided</small> : null}</td>
            <td className={`finance-amount ${signed(row.taxable) ?? ""}`}>{row.taxable ? money(row.taxable) : "—"}</td>
            {gst ? <>
              <td className="finance-amount">{row.cgst ? money(row.cgst) : "—"}</td><td className="finance-amount">{row.sgst ? money(row.sgst) : "—"}</td><td className="finance-amount">{row.igst ? money(row.igst) : "—"}</td>
            </> : <td className="finance-amount">{tax(row) ? money(tax(row)) : "—"}</td>}
            <td className={`finance-amount ${signed(row.invoiced) ?? ""}`}>{row.invoiced ? money(row.invoiced) : "—"}</td>
            <td className="finance-amount">{row.collected ? money(row.collected) : "—"}</td>
            <td className="finance-amount"><strong>{money(row.closingReceivables)}</strong></td>
          </tr>)}
          <tr className="books-total"><td>Total FY {data.fiscalYear}</td><td>{currency.total.invoicesIssued}</td><td className="finance-amount">{money(currency.total.taxable)}</td>
            {gst ? <><td className="finance-amount">{money(currency.total.cgst)}</td><td className="finance-amount">{money(currency.total.sgst)}</td><td className="finance-amount">{money(currency.total.igst)}</td></>
              : <td className="finance-amount">{money(tax(currency.total))}</td>}
            <td className="finance-amount">{money(currency.total.invoiced)}</td><td className="finance-amount">{money(currency.total.collected)}</td><td className="finance-amount">{money(currency.closingReceivables)}</td></tr>
        </Table>
      </section>;
    })}
  </>;
}

function MonthFilter({ months, value, onChange }: { months: string[]; value: string; onChange(month: string): void }) {
  return <Dropdown label="Month" value={value} onChange={onChange} options={[{ value: "", label: "Whole year" }, ...months.map((month) => ({ value: month, label: monthName(month) }))]} />;
}

function Register({ fy, months }: { fy: string; months: string[] }) {
  const defaults = useOrganizationDefaults();
  const [params, setParams] = useSearchParams();
  const month = params.get("month") ?? "";
  const { data, error } = useData<SalesRegister>(() => getSalesRegister(fy || undefined, month || undefined), [fy, month]);
  const setMonth = (next: string) => setParams((previous) => { const value = new URLSearchParams(previous); if (next) value.set("month", next); else value.delete("month"); return value; });
  const exportCsv = () => data && downloadCsv(`sales-register-${data.fiscalYear}${month ? `-${month}` : ""}.csv`, [
    ["Date", "Type", "Invoice", "Client", "GSTIN / tax ID", "Place of supply", "Currency", "Taxable", "CGST", "SGST", "IGST", "Other tax", "Total"],
    ...data.rows.map((row) => [row.date, voucherLabels[row.voucherType], row.invoiceNumber, row.clientName, row.clientTaxId, row.placeOfSupply, row.currency, row.taxable, row.cgst, row.sgst, row.igst, row.otherTax, row.total]),
  ]);
  return <>
    <div className="toolbar filter-bar directory-filters">
      <MonthFilter months={months} value={month} onChange={setMonth} />
      <Button type="button" disabled={!data?.rows.length} onClick={exportCsv}>Export CSV</Button>
    </div>
    {error && <Notice>{error}</Notice>}
    {!data && !error ? <p role="status">Loading the sales register…</p> : data && (data.rows.length ? <>
      <Table headers={["Date", "Invoice", "Client", "GSTIN / tax ID", "Place of supply", "Taxable", "CGST", "SGST", "IGST", "Total"]}>
        {data.rows.map((row) => {
          const money = (value: number) => value ? formatBillingMoney(value, row.currency, defaults.locale) : "—";
          return <tr key={`${row.voucherType}:${row.reference}`} className={row.voucherType === "INVOICE_VOID" ? "books-reversal" : undefined}>
            <td>{formatDate(row.date, defaults.locale)}</td>
            <td><Link to={appPath(`/app/finance/invoices/${encodeURIComponent(row.reference)}`)}>{row.invoiceNumber}</Link>{row.voucherType === "INVOICE_VOID" && <> <Badge label="Reversal" variant="danger" /></>}</td>
            <td>{row.clientName}</td><td>{row.clientTaxId || "—"}</td><td>{row.placeOfSupply || "—"}</td>
            <td className={`finance-amount ${signed(row.taxable) ?? ""}`}>{money(row.taxable)}</td>
            <td className="finance-amount">{money(row.cgst)}</td><td className="finance-amount">{money(row.sgst)}</td><td className="finance-amount">{money(row.igst + row.otherTax)}</td>
            <td className={`finance-amount ${signed(row.total) ?? ""}`}><strong>{money(row.total)}</strong></td>
          </tr>;
        })}
        {data.totals.map((total) => {
          const money = (value: number) => formatBillingMoney(value, total.currency, defaults.locale);
          return <tr key={total.currency} className="books-total"><td colSpan={5}>Total{data.totals.length > 1 ? ` ${total.currency}` : ""} · {total.invoices} invoice{total.invoices === 1 ? "" : "s"}</td>
            <td className="finance-amount">{money(total.taxable)}</td><td className="finance-amount">{money(total.cgst)}</td><td className="finance-amount">{money(total.sgst)}</td>
            <td className="finance-amount">{money(total.igst + total.otherTax)}</td><td className="finance-amount">{money(total.total)}</td></tr>;
        })}
      </Table>
      <p className="snapshot-note">Voided invoices appear twice: once when issued and once, negative, in the month they were voided, so each month's figures stay as they were reported.</p>
    </> : <Empty>No invoices were issued or voided {month ? `in ${monthName(month)}` : `in FY ${data.fiscalYear}`}.</Empty>)}
  </>;
}

function JournalView({ fy, months }: { fy: string; months: string[] }) {
  const defaults = useOrganizationDefaults();
  const [params, setParams] = useSearchParams();
  const month = params.get("month") ?? "", account = params.get("account") ?? "", clientKey = params.get("client") ?? "";
  const page = Math.max(0, Number(params.get("page") ?? 0) || 0);
  const [clients, setClients] = useState<BillingClient[]>([]);
  useEffect(() => { getClients().then(setClients).catch(() => undefined); }, []);
  const { data, error } = useData<Journal>(() => getJournal({ fy: fy || undefined, month: month || undefined, account: account || undefined, clientKey: clientKey || undefined, page, size: 50 }), [fy, month, account, clientKey, page]);
  const update = (changes: Record<string, string>) => setParams((previous) => {
    const value = new URLSearchParams(previous);
    for (const [key, next] of Object.entries(changes)) if (next) value.set(key, next); else value.delete(key);
    if (!("page" in changes)) value.delete("page");
    return value;
  });
  return <>
    <div className="toolbar filter-bar directory-filters">
      <MonthFilter months={months} value={month} onChange={(next) => update({ month: next })} />
      <Dropdown label="Account" value={account} onChange={(next) => update({ account: next })} options={[{ value: "", label: "All accounts" }, ...ledgerAccounts]} />
      <Dropdown label="Client" value={clientKey} searchable onChange={(next) => update({ client: next })}
        options={[{ value: "", label: "All clients" }, ...clients.map((client) => ({ value: client.clientKey, label: client.displayName }))]} />
    </div>
    {error && <Notice>{error}</Notice>}
    {!data && !error ? <p role="status">Loading the journal…</p> : data && (data.content.length ? <>
      <Table headers={["Date", "Voucher", "Account", "Particulars", "Debit", "Credit"]}>
        {data.content.map((line, index) => {
          const money = (value: number) => value ? formatBillingMoney(value, line.currency, defaults.locale) : "";
          return <tr key={`${line.voucherType}:${line.voucherNumber}:${line.account}:${index}`}>
            <td>{formatDate(line.date, defaults.locale)}</td>
            <td><Link to={appPath(`/app/finance/invoices/${encodeURIComponent(line.invoiceReference)}`)}>{line.voucherNumber}</Link><small className="cell-note">{voucherLabels[line.voucherType]}</small></td>
            <td>{line.accountName}</td>
            <td>{line.narration}</td>
            <td className="finance-amount">{money(line.debit)}</td><td className="finance-amount">{money(line.credit)}</td>
          </tr>;
        })}
        {data.totals.map((total) => <tr key={total.currency} className="books-total">
          <td colSpan={4}>Total{data.totals.length > 1 ? ` ${total.currency}` : ""}{account || clientKey ? " (filtered)" : total.debit === total.credit ? " · balanced" : " · not balanced"}</td>
          <td className="finance-amount">{formatBillingMoney(total.debit, total.currency, defaults.locale)}</td><td className="finance-amount">{formatBillingMoney(total.credit, total.currency, defaults.locale)}</td>
        </tr>)}
      </Table>
      <Pagination page={data.page} totalPages={data.totalPages} total={data.totalElements} size={data.size} onPage={(next) => update({ page: next ? String(next) : "" })} />
    </> : <Empty>No ledger entries match these filters.</Empty>)}
  </>;
}

function BookSettingsForm() {
  const defaults = useOrganizationDefaults();
  const [settings, setSettings] = useState<BookSettings | null>(null), [error, setError] = useState(""), [saved, setSaved] = useState(""), [busy, setBusy] = useState(false);
  const [start, setStart] = useState("4"), [lock, setLock] = useState("");
  useEffect(() => {
    getBookSettings().then((value) => { setSettings(value); setStart(String(value.fiscalYearStartMonth)); setLock(value.booksLockedUntil ?? ""); })
      .catch((reason) => setError(message(reason, "Unable to load the settings")));
  }, []);
  if (!settings && !error) return <p role="status">Loading settings…</p>;
  const startName = MONTHS[Number(start) - 1];
  return <form className="card" aria-label="Books settings" onSubmit={(event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(""); setSaved("");
    void updateBookSettings({ fiscalYearStartMonth: Number(start), booksLockedUntil: lock || null })
      .then((value) => { setSettings(value); setSaved(`Saved. The current financial year is ${value.currentFiscalYear}.`); })
      .catch((reason) => setError(message(reason, "Unable to save the settings"))).finally(() => setBusy(false));
  }}>
    {error && <Notice>{error}</Notice>}
    {saved && <Notice tone="success">{saved}</Notice>}
    <fieldset className="form-section">
      <legend>Financial year</legend>
      <div className="form-grid">
        <Dropdown label="Financial year starts in" value={start} onChange={setStart} hint={Number(start) === 4 ? "The Indian financial year: April to March." : undefined}
          options={MONTHS.map((label, index) => ({ value: String(index + 1), label }))} />
      </div>
      <p className="snapshot-note">Reports group months from {startName} to {MONTHS[(Number(start) + 10) % 12]}. Changing this regroups reports only; no entry changes. Invoice numbering has its own financial-year setting on each invoice template.</p>
    </fieldset>
    <fieldset className="form-section">
      <legend>Lock the books</legend>
      <div className="form-grid">
        <SettingsField label="Locked up to" hint="Usually the last day of a period you have filed or closed.">
          <input type="date" value={lock} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setLock(event.target.value)} />
        </SettingsField>
      </div>
      <p className="snapshot-note">{lock ? `Nothing can be issued, received or voided on or before ${formatDate(lock, defaults.locale)}. Voiding an older invoice posts its reversal on today's date instead.` : "Not locked. Any date can be posted."}
        {lock && <> <button type="button" className="link-button" onClick={() => setLock("")}>Remove the lock</button></>}</p>
    </fieldset>
    <div className="form-actions"><Button variant="primary" disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button></div>
  </form>;
}

function SettingsField({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return <div className="field"><label>{label}{children}</label><small className="field-hint">{hint}</small></div>;
}

/** Statement of account for one client and financial year, printable. Used on the client profile. */
export function ClientStatement({ clientKey }: { clientKey: string }) {
  const defaults = useOrganizationDefaults();
  const [years, setYears] = useState<FiscalYearOption[]>([]);
  const [fy, setFy] = useState("");
  const [yearError, setYearError] = useState("");
  useEffect(() => {
    getFiscalYears().then((list) => { setYears(list); setFy(list.find((year) => year.current)?.label ?? list[0]?.label ?? ""); })
      .catch((reason) => setYearError(reason instanceof Error ? reason.message : "Unable to load financial years"));
  }, []);
  const { data, error } = useData<Statement | null>(() => fy ? getStatement(clientKey, fy) : Promise.resolve(null), [clientKey, fy]);
  return <section className="card" aria-labelledby="statement-heading">
    <div className="card-heading">
      <h3 id="statement-heading">Statement of account</h3>
      <div className="toolbar">
        {years.length > 0 && <Dropdown label="Financial year" value={fy} onChange={setFy} options={years.map((year) => ({ value: year.label, label: `FY ${year.label}` }))} />}
        <Button size="sm" onClick={() => window.print()}>Print</Button>
        {data && <Button size="sm" onClick={() => exportStatement(data)}>Download CSV</Button>}
      </div>
    </div>
    {error && <Notice>{error}</Notice>}
    {yearError && <Notice>{yearError}</Notice>}
    {!data && !error && fy ? <p role="status">Loading the statement…</p> : data && <div className="statement-print-area">
      <p className="snapshot-note">{data.clientName} · FY {data.fiscalYear} · {formatDate(data.start, defaults.locale)} to {formatDate(data.end, defaults.locale)}</p>
      {data.basis && <p className="snapshot-note">{data.basis}</p>}
      {data.currencies.map((currency) => {
        const money = (value: number) => formatBillingMoney(value, currency.currency, defaults.locale);
        return <Table key={currency.currency} headers={["Date", "Voucher", "Particulars", "Debit", "Credit", "Balance"]}>
          <tr className="books-opening"><td>{formatDate(data.start, defaults.locale)}</td><td colSpan={4}>Opening balance{data.currencies.length > 1 ? ` (${currency.currency})` : ""}</td><td className="finance-amount">{money(currency.openingBalance)}</td></tr>
          {currency.lines.map((line, index) => <tr key={`${line.voucherNumber}:${line.voucherType}:${index}`}>
            <td>{formatDate(line.date, defaults.locale)}</td>
            <td><Link to={appPath(`/app/finance/invoices/${encodeURIComponent(line.invoiceReference)}`)}>{line.voucherNumber}</Link><small className="cell-note">{voucherLabels[line.voucherType]}</small></td>
            <td>{line.narration}</td>
            <td className="finance-amount">{line.debit ? money(line.debit) : ""}</td><td className="finance-amount">{line.credit ? money(line.credit) : ""}</td>
            <td className="finance-amount">{money(line.balance)}</td>
          </tr>)}
          <tr className="books-total"><td colSpan={3}>Closing balance</td><td className="finance-amount">{money(currency.totalDebit)}</td><td className="finance-amount">{money(currency.totalCredit)}</td><td className="finance-amount">{money(currency.closingBalance)}</td></tr>
        </Table>;
      })}
      {(data.unallocated ?? []).length > 0 && <Table headers={["Date", "Receipt", "Receipt total", "Still unallocated", "Currency"]}>
        {data.unallocated!.map((receipt) => <tr key={receipt.receiptNumber}>
          <td>{formatDate(receipt.date, defaults.locale)}</td>
          <td>{receipt.receiptNumber}</td>
          <td className="finance-amount">{formatBillingMoney(receipt.amount, receipt.currency, defaults.locale)}</td>
          <td className="finance-amount">{formatBillingMoney(receipt.unallocated, receipt.currency, defaults.locale)}</td>
          <td>{receipt.currency}</td>
        </tr>)}
      </Table>}
      {(data.unallocated ?? []).length > 0 && <p className="snapshot-note">Unallocated receipts are client credit. They are not included in the closing receivable until they are allocated to an invoice.</p>}
      {data.currencies.every((currency) => currency.lines.length === 0) && <p className="snapshot-note">No invoices or receipts for {data.clientName} in FY {data.fiscalYear}.</p>}
    </div>}
  </section>;
}

function exportStatement(data: Statement) {
  const rows: (string | number | null)[][] = [["Basis", data.basis ?? ""], ["Client", data.clientName], ["Financial year", data.fiscalYear], ["From", data.start], ["To", data.end], []];
  for (const currency of data.currencies) {
    rows.push(["Currency", currency.currency], ["Date", "Voucher", "Type", "Particulars", "Debit", "Credit", "Balance"]);
    rows.push([data.start, "", "", "Opening balance", "", "", currency.openingBalance]);
    for (const line of currency.lines) rows.push([line.date, line.voucherNumber, line.voucherType, line.narration, line.debit, line.credit, line.balance]);
    rows.push(["", "", "", "Closing balance", currency.totalDebit, currency.totalCredit, currency.closingBalance], []);
  }
  rows.push(["Unallocated receipts (not part of the receivable)"]);
  rows.push(["Date", "Receipt", "Amount", "Unallocated", "Currency"]);
  for (const receipt of data.unallocated ?? []) rows.push([receipt.date, receipt.receiptNumber, receipt.amount, receipt.unallocated, receipt.currency]);
  downloadCsv(`statement-${data.clientKey}-${data.fiscalYear}.csv`, rows);
}
