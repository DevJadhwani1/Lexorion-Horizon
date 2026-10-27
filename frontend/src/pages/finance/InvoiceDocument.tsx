import { useState, type CSSProperties, type ReactNode } from "react";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import type { BillTo, InvoiceStatus, LabelledValue, RenderTemplate, TaxLine } from "../../features/finance/financeApi";
import { amountInWords } from "../../lib/amountInWords";
import { formatMoney } from "../../lib/format";
import "./omega-invoice.css";

export interface DocumentLine { lineNumber: number; itemCode?: string | null; hsnSac?: string | null; unit?: string | null; description: string; quantity: number; unitPrice: number; taxRate: number; subtotal: number; taxAmount: number; total: number }
/** What a bill shows. An issued invoice supplies it directly; the template editor builds a sample. */
export interface DocumentData {
  number: string | null;
  status?: InvoiceStatus;
  currency: string;
  issueDate: string;
  dueDate: string;
  placeOfSupply?: string | null;
  billTo: BillTo;
  customFields: Record<string, string>;
  lines: DocumentLine[];
  subtotal: number;
  taxBreakdown: TaxLine[];
  total: number;
  amountPaid: number;
  balanceDue: number;
  notes?: string | null;
}

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
function ordinal(day: number) {
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][day % 10] ?? "th";
  return `${day}${suffix}`;
}
/** Dates as the template asks: 30th May 2026, 30 May 2026, 30/05/2026, or 02 Sept 2026. */
export function documentDate(value: string | null | undefined, style: RenderTemplate["config"]["dateStyle"] | "COMPACT"): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return value || "—";
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (style === "NUMERIC") return `${match[3]}/${match[2]}/${year}`;
  if (style === "COMPACT") return `${String(day).padStart(2, "0")} ${shortMonths[month - 1]} ${year}`;
  return `${style === "ORDINAL" ? ordinal(day) : day} ${style === "ORDINAL" ? months[month - 1] : months[month - 1].slice(0, 3)} ${year}`;
}

/** Saved name follows the issued files: brand, client, number with hyphens. The browser adds .pdf. */
export function invoiceDownloadTitle(sellerLegalName: string, clientName: string, number: string): string {
  const brand = sellerLegalName.replace(/\s+India Private Limited$/i, "").trim() || sellerLegalName.trim() || "Invoice";
  const client = clientName.trim().split(/\s+/)[0] || "Client";
  return `${brand} · ${client} · ${number.replaceAll("/", "-")}`;
}

export function printDocument(downloadTitle: string) {
  const previous = document.title;
  const apply = () => { document.title = downloadTitle; };
  const restore = () => {
    document.title = previous;
    window.removeEventListener("beforeprint", apply);
    window.removeEventListener("afterprint", restore);
  };
  apply();
  window.addEventListener("beforeprint", apply);
  window.addEventListener("afterprint", restore);
  window.setTimeout(() => window.print(), 0);
}

function displayPhone(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = parsePhoneNumberFromString(value);
  if (!parsed) return value;
  return `+${parsed.countryCallingCode} ${parsed.nationalNumber}`;
}

function displayPhoneGrouped(value: string | null | undefined): string {
  if (!value) return "";
  return parsePhoneNumberFromString(value)?.formatInternational() ?? value;
}

function displaySite(value: string): string {
  return value.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function sellerIdentifiers(items: LabelledValue[]): LabelledValue[] {
  const filled = items.filter((item) => item.value);
  const pan = filled.find((item) => item.label.trim().toUpperCase() === "PAN");
  const cin = filled.find((item) => item.label.trim().toUpperCase() === "CIN");
  if (!pan || !cin) return filled;
  const merged = { label: "PAN / CIN", value: `${pan.value} · ${cin.value}` };
  let inserted = false;
  return filled.flatMap((item) => {
    if (item !== pan && item !== cin) return [item];
    if (inserted) return [];
    inserted = true;
    return [merged];
  });
}

function identifier(items: LabelledValue[], label: string) {
  return items.find((item) => item.label.trim().toUpperCase() === label)?.value?.trim() ?? "";
}

function paymentLabel(label: string) {
  const name = label.trim().toLowerCase();
  if (name === "account number" || name === "a/c no." || name === "a/c no") return "A/C No.";
  return label;
}

/** The one Omega Hires invoice sheet. Markup matches the invoice builder page. */
function OmegaInvoiceSheet({ data, template, locale }: { data: DocumentData; template: RenderTemplate; locale?: string }) {
  const c = template.config;
  const seller = c.seller;
  const sellerName = seller.legalName || "Omega Hires India Private Limited";
  const moneyLocale = data.currency === "INR" ? "en-IN" : locale;
  const money = (value: number) => formatMoney(value, data.currency, moneyLocale);
  const compactHeader = data.issueDate >= "2026-07-28";
  const headerDate = (value: string | null | undefined) => documentDate(value, compactHeader ? "COMPACT" : c.dateStyle);
  const date = (value: string | null | undefined) => documentDate(value, c.dateStyle);
  const title = c.document.title.trim().toUpperCase();
  const heading = title === "TAX INVOICE" || title === "INVOICE" ? "Invoice" : c.document.title;
  const kicker = c.document.subtitle || (title === "TAX INVOICE" || title === "INVOICE" ? "Tax invoice" : "");
  const pan = identifier(seller.identifiers, "PAN");
  const cin = identifier(seller.identifiers, "CIN");
  const gstin = identifier(seller.identifiers, "GSTIN");
  const tan = identifier(seller.identifiers, "TAN");
  const fields = data.customFields ?? {};
  const defined = new Set(c.customFields.map((field) => field.key));
  const value = (key: string) => fields[key]?.trim() ?? "";
  const candidate = value("candidate");
  const position = value("position");
  const joining = value("joiningDate");
  const engagement = value("engagementType") || value("recruitmentType");
  const replacement = value("replacementPeriod");
  const agreement = value("serviceAgreementRef");
  const po = value("poReference") || value("poNumber");
  const has = (key: string, filled: string) => defined.has(key) || Boolean(filled);
  const showEngagement = has("candidate", candidate) || has("position", position) || has("joiningDate", joining) || Boolean(engagement || replacement || agreement);
  const showSac = data.lines.some((line) => line.hsnSac);
  const indianBuyer = !data.billTo.country || data.billTo.country === "IN";
  const contact = data.billTo.contactName?.trim() ?? "";
  const [attn, department] = contact.includes("·")
    ? contact.split("·").map((part) => part.trim())
    : [contact, indianBuyer && contact ? "Accounts Payable" : ""];
  const taxLabel = (label: string) => label === "CGST" || label === "SGST" ? `${label} (½)` : label;
  const payments = c.paymentDetails.filter((item) => item.value);
  return <article className="omega-invoice" aria-label={`${heading} ${data.number ?? "draft"}`}>
    <div className="a4 sovereign density-regular">
      <div className="top-bar" />
      <div className="sov-header">
        <div className="sov-brand">
          <img src="/omega-invoice/omega_hires_logo.png" alt="Omega Hires" />
          {seller.tagline && <div className="tag">{seller.tagline}</div>}
          {seller.subline && <div className="sub">{seller.subline}</div>}
        </div>
        <div className="sov-doctype">
          {kicker && <div className="label">{kicker}</div>}
          <div className="title">{heading}</div>
          <div className="num">{data.number ?? "Draft"}</div>
          {c.document.copyLabel && <div className="copy">{c.document.copyLabel}</div>}
        </div>
      </div>
      <div className="sov-meta-strip">
        <div className="cell"><div className="k">Date Issued</div><div className="v">{headerDate(data.issueDate)}</div></div>
        <div className="cell"><div className="k">Due</div><div className="v">{headerDate(data.dueDate)}</div></div>
        {po && <div className="cell"><div className="k">PO Reference</div><div className="v">{po}</div></div>}
        <div className="cell"><div className="k">Place of Supply</div><div className="v">{data.placeOfSupply || "—"}</div></div>
      </div>
      <div className="sov-parties">
        <div className="party-block">
          <div className="label">From</div>
          <div className="name">{sellerName}</div>
          {seller.address && <div className="row"><span className="k">Address</span><span className="v">{seller.address}</span></div>}
          {(seller.phone || seller.email) && <div className="row"><span className="k">Contact</span><span className="v">{[displayPhone(seller.phone), seller.email].filter(Boolean).join(" · ")}</span></div>}
          {seller.website && <div className="row"><span className="k">Web</span><span className="v">{displaySite(seller.website)}</span></div>}
          {gstin && <div className="row"><span className="k">GSTIN</span><span className="v gst">{gstin}</span></div>}
          {(pan || cin) && <div className="row"><span className="k">PAN / CIN</span><span className="v">{[pan, cin].filter(Boolean).join(" · ")}</span></div>}
          {tan && <div className="row"><span className="k">TAN</span><span className="v">{tan}</span></div>}
        </div>
        <div className="party-block">
          <div className="label">Billed To</div>
          <div className="name">{data.billTo.name}</div>
          {(attn || department) && <div className="row"><span className="k">Attn.</span><span className="v">{[attn, department].filter(Boolean).join(" · ")}</span></div>}
          {data.billTo.address && <div className="row"><span className="k">Address</span><span className="v">{data.billTo.address}</span></div>}
          {(data.billTo.email || data.billTo.phone) && <div className="row"><span className="k">Contact</span><span className="v">{[data.billTo.email, displayPhoneGrouped(data.billTo.phone)].filter(Boolean).join(" · ")}</span></div>}
          {data.billTo.taxId && <div className="row"><span className="k">GSTIN</span><span className="v gst">{data.billTo.taxId}</span></div>}
        </div>
      </div>
      {showEngagement && <div className="rec-card" aria-label={c.document.detailsTitle}>
        <div className="head"><div className="title">Recruitment Engagement</div></div>
        <div className="grid">
          {has("candidate", candidate) && <div className="item"><div className="k">Candidate</div><div className="v">{candidate || "—"}</div></div>}
          {has("position", position) && <div className="item"><div className="k">Position / Role</div><div className="v">{position || "—"}</div></div>}
          {has("joiningDate", joining) && <div className="item"><div className="k">Joining Date</div><div className="v">{joining ? date(joining) : "—"}</div></div>}
          {(defined.has("engagementType") || defined.has("recruitmentType") || engagement) && <div className="item"><div className="k">Engagement Type</div><div className="v">{engagement || "—"}</div></div>}
          {(defined.has("replacementPeriod") || replacement) && <div className="item"><div className="k">Replacement Period</div><div className="v">{replacement || "—"}</div></div>}
          {(defined.has("serviceAgreementRef") || agreement) && <div className="item"><div className="k">Agreement Ref.</div><div className="v">{agreement || "—"}</div></div>}
        </div>
      </div>}
      <div className="items">
        <table>
          <thead><tr>
            <th className="c" style={{ width: 32 }}>Sr.</th>
            {c.columns.showItemCode && <th style={{ width: 80 }}>Code</th>}
            {showSac && <th style={{ width: 64 }}>SAC</th>}
            <th>Description</th>
            <th className="c" style={{ width: 32 }}>Qty</th>
            <th className="r" style={{ width: 80 }}>Rate</th>
            <th className="r" style={{ width: 80 }}>Taxable</th>
            <th className="c" style={{ width: 50 }}>GST</th>
            <th className="r" style={{ width: 88 }}>Total</th>
          </tr></thead>
          <tbody>{data.lines.map((line) => <tr key={line.lineNumber}>
            <td className="c sr">{line.lineNumber}</td>
            {c.columns.showItemCode && <td><div className="code">{line.itemCode || "—"}</div></td>}
            {showSac && <td><div className="code">{line.hsnSac || "—"}</div></td>}
            <td><div className="desc">{line.description}</div></td>
            <td className="c">{line.quantity}</td>
            <td className="r">{money(line.unitPrice)}</td>
            <td className="r">{money(line.subtotal)}</td>
            <td className="c">{line.taxRate}%</td>
            <td className="r"><strong>{money(line.total)}</strong></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="totals-wrap" style={{ marginTop: 20 }}>
        {c.showAmountInWords && <div className="words">
          <div className="k">Amount in words ({data.currency})</div>
          <div className="v">{amountInWords(data.total, data.currency)}</div>
        </div>}
        <div className="totals">
          <div className="row"><span>{data.taxBreakdown.length ? "Subtotal (Taxable)" : "Subtotal"}</span><span className="v">{money(data.subtotal)}</span></div>
          {data.taxBreakdown.map((tax) => <div className="row" key={tax.label}><span>{taxLabel(tax.label)}</span><span className="v">{money(tax.amount)}</span></div>)}
          <div className="row grand"><span>Grand Total</span><span className="v">{money(data.total)}</span></div>
          {data.amountPaid > 0 && <div className="row"><span>Amount Paid</span><span className="v">{money(data.amountPaid)}</span></div>}
          {data.status !== "VOID" && <div className="row balance"><span>Balance Due</span><span className="v">{money(data.balanceDue)}</span></div>}
        </div>
      </div>
      <div className="foot">
        {data.notes && <div className="notes" style={{ margin: "0 40px 14px", background: "#fffbeb" }}><div className="k">Notes</div><div className="v">{data.notes}</div></div>}
        <div className="grid">
          <div>
            {payments.length > 0 && <><div className="col-title">Payment Details</div>
              {payments.map((item) => <div className="bank-row" key={item.label}><span className="k">{paymentLabel(item.label)}</span><span className="v">{item.value}</span></div>)}</>}
          </div>
          <div>
            {c.terms.length > 0 && <><div className="col-title">Terms &amp; Conditions</div>
              <ul className="terms-list">{c.terms.map((term) => <li key={term}>{term}</li>)}</ul></>}
          </div>
          <div className="sig">
            <div className="for">For</div>
            <div className="co">{sellerName}</div>
            {c.signatory.name && <div className="hw">{c.signatory.name}</div>}
            <div className="line">{c.signatory.name ? `${c.signatory.name} · ${c.signatory.title || "Authorised Signatory"}` : (c.signatory.title || "Authorised Signatory")}</div>
            <div className="gen">{c.footerNote || "This is a computer-generated invoice and does not require a physical signature."}</div>
          </div>
        </div>
        <div className="bottom-bar" />
      </div>
    </div>
  </article>;
}

function InvoiceWorkspace({ number, clientName, invoicesHref, onExport, children }: {
  number: string; clientName: string; invoicesHref?: string; onExport(): void; children: ReactNode;
}) {
  const [zoom, setZoom] = useState(0.95);
  const step = (delta: number) => setZoom((current) => Math.min(1.4, Math.max(0.5, Math.round((current + delta) * 10) / 10)));
  return <main className="omega-workspace">
    <div className="toolbar">
      <div className="tb-left">
        <div className="tb-crumbs">
          {invoicesHref ? <a className="crumb" href={invoicesHref}>Invoices</a> : <span className="crumb">Invoices</span>}
          <span className="sep">/</span>
          <span className="crumb active">{number}</span>
          <span className="sep">·</span>
          <span className="crumb">{clientName}</span>
        </div>
      </div>
      <div className="tb-right">
        <div className="template-switch" role="tablist" aria-label="Invoice template">
          <button type="button" className="active" aria-pressed="true">Sovereign</button>
          <button type="button" disabled>Ledger</button>
          <button type="button" disabled>Pulse</button>
        </div>
        <div className="zoom-pill">
          <button type="button" title="Zoom out" onClick={() => step(-0.1)}>−</button>
          <span className="val">{Math.round(zoom * 100)}%</span>
          <button type="button" title="Zoom in" onClick={() => step(0.1)}>+</button>
        </div>
        <button type="button" className="tb-btn primary" onClick={onExport}>Export</button>
      </div>
    </div>
    <div className="canvas">
      <div className="canvas-stage" style={{ transform: `scale(${zoom})` }}>
        <div className="canvas-stage-pages tmpl-sovereign density-regular">
          {children}
        </div>
      </div>
    </div>
  </main>;
}

export function InvoiceDocument({ data, template, fallbackSellerName, locale, viewer, invoicesHref, onExport }: {
  data: DocumentData; template: RenderTemplate; fallbackSellerName?: string; locale?: string;
  viewer?: boolean; invoicesHref?: string; onExport?(): void;
}) {
  const c = template.config;
  const seller = c.seller;
  const sellerName = seller.legalName || fallbackSellerName || "Your company";
  if (template.layout === "MODERN" && /^omega hires\b/i.test(seller.legalName ?? "")) {
    const sheet = <OmegaInvoiceSheet data={data} template={template} locale={locale} />;
    if (!viewer) return sheet;
    return <InvoiceWorkspace number={data.number ?? "Draft"} clientName={data.billTo.name} invoicesHref={invoicesHref} onExport={onExport ?? (() => window.print())}>{sheet}</InvoiceWorkspace>;
  }
  const moneyLocale = data.currency === "INR" ? "en-IN" : locale;
  const money = (value: number) => formatMoney(value, data.currency, moneyLocale);
  const date = (value: string | null | undefined) => documentDate(value, c.dateStyle);
  // Issued Omega Hires bills print ordinal dates through 7 July 2026 and 02 Sept 2026 from 28 July. Joining dates stay on the template style.
  const compactHeader = /^omega hires\b/i.test(seller.legalName ?? "") && data.issueDate >= "2026-07-28";
  const headerDate = (value: string | null | undefined) => documentDate(value, compactHeader ? "COMPACT" : c.dateStyle);
  const omegaBill = /^omega hires\b/i.test(seller.legalName ?? "");
  const taxInvoiceHeading = c.document.title.trim().toUpperCase() === "TAX INVOICE" && !c.document.subtitle;
  const logo = c.branding.logo || (omegaBill ? "/omega-hires-logo.png" : null);
  const gst = c.tax.mode === "GST";
  const showTax = c.tax.mode !== "NONE" || data.lines.some((line) => line.taxRate > 0);
  const showHsn = Boolean(c.columns.showHsnSac && data.lines.some((line) => line.hsnSac));
  const taxHeading = gst ? "GST" : c.tax.label;
  const draft = !data.number && data.status !== "VOID";
  const fieldValues = c.customFields.filter((field) => data.customFields[field.key]);
  const inHeader = new Set(["poReference", "poNumber"]);
  const headerFields = fieldValues.filter((field) => inHeader.has(field.key));
  const detailFields = fieldValues.filter((field) => !inHeader.has(field.key));
  const attention = data.billTo.contactName && omegaBill && !data.billTo.contactName.includes("·")
    ? `${data.billTo.contactName} · Accounts Payable` : data.billTo.contactName;
  const taxLabel = (label: string) => omegaBill && (label === "CGST" || label === "SGST") ? `${label} (½)` : label;
  const contact = [displayPhone(seller.phone), seller.email].filter(Boolean).join(" · ");
  const buyerContact = [data.billTo.email, displayPhone(data.billTo.phone)].filter(Boolean).join(" · ");
  const identifiers = sellerIdentifiers(seller.identifiers);
  const style = { "--doc-primary": c.branding.primaryColor, "--doc-accent": c.branding.accentColor } as CSSProperties;
  return <article className={`invoice-doc invoice-doc--${template.layout.toLowerCase()}`} style={style} aria-label={`${taxInvoiceHeading ? "Invoice" : c.document.title} ${data.number ?? "draft"}`}>
    {draft && <div className="invoice-doc-watermark" aria-hidden="true">Draft</div>}
    {data.status === "VOID" && <div className="invoice-doc-watermark" aria-hidden="true">Void</div>}
    <div className="invoice-doc-bar" aria-hidden="true" />
    <header className="invoice-doc-header">
      <div className="invoice-doc-brand">
        {logo ? <img className="invoice-doc-logo" src={logo} alt="" /> : <strong className="invoice-doc-wordmark">{sellerName}</strong>}
        {seller.tagline && <p className="invoice-doc-tagline">{seller.tagline}</p>}
        {seller.subline && <p className="invoice-doc-subline">{seller.subline}</p>}
      </div>
      <div className="invoice-doc-heading">
        {taxInvoiceHeading ? <span className="invoice-doc-kicker">Tax invoice</span> : c.document.subtitle && <span className="invoice-doc-kicker">{c.document.subtitle}</span>}
        <h2>{taxInvoiceHeading ? "Invoice" : c.document.title}</h2>
        <strong className="invoice-doc-number">{data.number ?? "Draft"}</strong>
        {c.document.copyLabel && <span className="invoice-doc-copy">{c.document.copyLabel}</span>}
      </div>
    </header>
    <dl className="invoice-doc-meta">
      <div><dt>Date issued</dt><dd>{headerDate(data.issueDate)}</dd></div>
      <div><dt>Due</dt><dd>{headerDate(data.dueDate)}</dd></div>
      {headerFields.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{field.type === "DATE" ? date(data.customFields[field.key]) : data.customFields[field.key]}</dd></div>)}
      {(gst || data.placeOfSupply) && <div><dt>Place of supply</dt><dd>{data.placeOfSupply || "—"}</dd></div>}
    </dl>
    <section className="invoice-doc-parties">
      <div>
        <h3>From</h3>
        <strong className="invoice-doc-party">{sellerName}</strong>
        <dl>
          {seller.address && <div><dt>Address</dt><dd>{seller.address}</dd></div>}
          {contact && <div><dt>Contact</dt><dd>{contact}</dd></div>}
          {seller.website && <div><dt>Web</dt><dd>{displaySite(seller.website)}</dd></div>}
          {identifiers.map((item) => <div key={item.label}><dt>{item.label}</dt><dd className="invoice-doc-id">{item.value}</dd></div>)}
        </dl>
      </div>
      <div>
        <h3>Billed to</h3>
        <strong className="invoice-doc-party">{data.billTo.name}</strong>
        <dl>
          {attention && <div><dt>Attn.</dt><dd>{attention}</dd></div>}
          {data.billTo.address && <div><dt>Address</dt><dd>{data.billTo.address}</dd></div>}
          {buyerContact && <div><dt>Contact</dt><dd>{buyerContact}</dd></div>}
          {data.billTo.taxId && <div><dt>{gst ? "GSTIN" : "Tax ID"}</dt><dd className="invoice-doc-id">{data.billTo.taxId}</dd></div>}
        </dl>
      </div>
    </section>
    {detailFields.length > 0 && <section className="invoice-doc-details" aria-label={c.document.detailsTitle}>
      <h3>{c.document.detailsTitle}</h3>
      <dl>{detailFields.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{field.type === "DATE" ? date(data.customFields[field.key]) : data.customFields[field.key]}</dd></div>)}</dl>
    </section>}
    <table className="invoice-doc-items">
      <thead><tr>
        <th>Sr.</th>{c.columns.showItemCode && <th>{c.columns.itemCodeLabel}</th>}<th className="invoice-doc-description">Description</th>{showHsn && <th>HSN/SAC</th>}
        <th className="num">Qty</th><th className="num">Rate</th>{showTax && <th className="num">Taxable</th>}{showTax && <th className="num">{taxHeading}</th>}<th className="num">Total</th>
      </tr></thead>
      <tbody>{data.lines.map((line) => <tr key={line.lineNumber}>
        <td className="invoice-doc-sr">{line.lineNumber}</td>{c.columns.showItemCode && <td className="invoice-doc-code">{line.itemCode || "—"}</td>}
        <td className="invoice-doc-description">{line.description}</td>{showHsn && <td className="invoice-doc-code">{line.hsnSac || "—"}</td>}
        <td className="num">{line.quantity}{line.unit && <small className="invoice-doc-unit"> {line.unit}</small>}</td><td className="num">{money(line.unitPrice)}</td>
        {showTax && <td className="num">{money(line.subtotal)}</td>}{showTax && <td className="num">{line.taxRate ? `${line.taxRate}%` : "—"}</td>}<td className="num strong">{money(line.total)}</td>
      </tr>)}</tbody>
    </table>
    <section className="invoice-doc-summary">
      {c.showAmountInWords ? <div className="invoice-doc-words"><span>Amount in words ({data.currency})</span><strong>{amountInWords(data.total, data.currency)}</strong></div> : <div />}
      <dl className="invoice-doc-totals">
        <div><dt>{data.taxBreakdown.length ? "Subtotal (Taxable)" : "Subtotal"}</dt><dd>{money(data.subtotal)}</dd></div>
        {data.taxBreakdown.map((tax) => <div key={tax.label}><dt>{taxLabel(tax.label)}</dt><dd>{money(tax.amount)}</dd></div>)}
        <div className="invoice-doc-grand"><dt>Grand total</dt><dd>{money(data.total)}</dd></div>
        {data.amountPaid > 0 && <div><dt>Paid</dt><dd>{money(data.amountPaid)}</dd></div>}
        {data.status !== "VOID" && <div className="invoice-doc-balance"><dt>Balance Due</dt><dd>{money(data.balanceDue)}</dd></div>}
      </dl>
    </section>
    {data.notes && <section className="invoice-doc-notes"><h3>Notes</h3><p>{data.notes}</p></section>}
    <footer className="invoice-doc-footer">
      <div>
        {c.paymentDetails.some((item) => item.value) && <><h3>Payment details</h3>
          <dl>{c.paymentDetails.filter((item) => item.value).map((item) => <div key={item.label}><dt>{item.label.trim().toLowerCase() === "account number" ? "A/C no." : item.label}</dt><dd>{item.value}</dd></div>)}</dl></>}
      </div>
      <div>
        {c.terms.length > 0 && <><h3>Terms &amp; conditions</h3><ul>{c.terms.map((term) => <li key={term}>{term}</li>)}</ul></>}
      </div>
      <div className="invoice-doc-sign">
        <span>For</span>
        <strong>{sellerName}</strong>
        {c.signatory.signatureImage ? <img src={c.signatory.signatureImage} alt={`Signature of ${c.signatory.name || sellerName}`} />
          : c.signatory.name && <span className="invoice-doc-signature" aria-hidden="true">{c.signatory.name}</span>}
        {(c.signatory.name || c.signatory.title) && <small>{[c.signatory.name, c.signatory.title].filter(Boolean).join(" · ")}</small>}
        {c.footerNote && <em>{c.footerNote}</em>}
      </div>
    </footer>
    <div className="invoice-doc-bar invoice-doc-bar--bottom" aria-hidden="true" />
  </article>;
}
