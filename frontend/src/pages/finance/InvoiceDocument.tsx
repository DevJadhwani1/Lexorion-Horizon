import type { CSSProperties } from "react";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import type { BillTo, InvoiceStatus, LabelledValue, RenderTemplate, TaxLine } from "../../features/finance/financeApi";
import { amountInWords } from "../../lib/amountInWords";
import { formatMoney } from "../../lib/format";

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

export function InvoiceDocument({ data, template, fallbackSellerName, locale }: { data: DocumentData; template: RenderTemplate; fallbackSellerName?: string; locale?: string }) {
  const c = template.config;
  const seller = c.seller;
  const sellerName = seller.legalName || fallbackSellerName || "Your company";
  const moneyLocale = data.currency === "INR" ? "en-IN" : locale;
  const money = (value: number) => formatMoney(value, data.currency, moneyLocale);
  const date = (value: string | null | undefined) => documentDate(value, c.dateStyle);
  // Issued Omega Hires bills print ordinal dates through 7 July 2026 and 02 Sept 2026 from 28 July. Joining dates stay on the template style.
  const compactHeader = /^omega hires\b/i.test(seller.legalName ?? "") && data.issueDate >= "2026-07-28";
  const headerDate = (value: string | null | undefined) => documentDate(value, compactHeader ? "COMPACT" : c.dateStyle);
  const taxInvoiceHeading = c.document.title.trim().toUpperCase() === "TAX INVOICE" && !c.document.subtitle;
  const logo = c.branding.logo || (compactHeader || /^omega hires\b/i.test(seller.legalName ?? "") ? "/omega-hires-logo.png" : null);
  const gst = c.tax.mode === "GST";
  const showTax = c.tax.mode !== "NONE" || data.lines.some((line) => line.taxRate > 0);
  const showHsn = Boolean(c.columns.showHsnSac && data.lines.some((line) => line.hsnSac));
  const taxHeading = gst ? "GST" : c.tax.label;
  const draft = !data.number && data.status !== "VOID";
  const fieldValues = c.customFields.filter((field) => data.customFields[field.key]);
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
        {logo && <strong className="invoice-doc-legal">{sellerName}</strong>}
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
          {data.billTo.contactName && <div><dt>Attn.</dt><dd>{data.billTo.contactName}</dd></div>}
          {data.billTo.address && <div><dt>Address</dt><dd>{data.billTo.address}</dd></div>}
          {buyerContact && <div><dt>Contact</dt><dd>{buyerContact}</dd></div>}
          {data.billTo.taxId && <div><dt>{gst ? "GSTIN" : "Tax ID"}</dt><dd className="invoice-doc-id">{data.billTo.taxId}</dd></div>}
        </dl>
      </div>
    </section>
    {fieldValues.length > 0 && <section className="invoice-doc-details" aria-label={c.document.detailsTitle}>
      <h3>{c.document.detailsTitle}</h3>
      <dl>{fieldValues.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{field.type === "DATE" ? date(data.customFields[field.key]) : data.customFields[field.key]}</dd></div>)}</dl>
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
        {data.taxBreakdown.map((tax) => <div key={tax.label}><dt>{tax.label}</dt><dd>{money(tax.amount)}</dd></div>)}
        <div className="invoice-doc-grand"><dt>Grand total</dt><dd>{money(data.total)}</dd></div>
        {data.amountPaid > 0 && <div><dt>Paid</dt><dd>{money(data.amountPaid)}</dd></div>}
        {data.status !== "VOID" && <div className="invoice-doc-balance"><dt>Balance due</dt><dd>{money(data.balanceDue)}</dd></div>}
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
