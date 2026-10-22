import { apiRequest } from "../../api/httpClient";
import type { Page } from "../../api/types";

export type ClientStatus = "ACTIVE" | "ARCHIVED";
export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";
export type PaymentMethod = "BANK_TRANSFER" | "UPI" | "CARD" | "CASH" | "CHEQUE" | "OTHER";
export const paymentMethods: PaymentMethod[] = ["BANK_TRANSFER", "UPI", "CARD", "CASH", "CHEQUE", "OTHER"];

export interface BillingClient {
  clientKey: string;
  displayName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  taxId: string | null;
  region: string | null;
  /** ISO 3166-1 alpha-2, for example IN. */
  country: string | null;
  currency: string;
  paymentTermsDays: number;
  status: ClientStatus;
  outstandingAmount: number;
  openInvoices: number;
  createdAt: string;
  updatedAt: string;
}
export interface ClientInput {
  clientKey?: string;
  displayName: string;
  contactName?: string;
  region?: string;
  country?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  taxId?: string;
  currency: string;
  paymentTermsDays?: number;
}
export interface InvoiceLine {
  lineNumber: number;
  itemCode: string | null;
  hsnSac: string | null;
  unit: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
}
export interface InvoiceSummary {
  /** Stable, URL-safe identifier (REF-00001). Use it in links and API paths. */
  reference: string;
  /** The template's number, assigned when the invoice is issued; null for drafts. */
  invoiceNumber: string | null;
  clientKey: string;
  clientName: string;
  status: InvoiceStatus;
  overdue: boolean;
  currency: string;
  issueDate: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  updatedAt: string;
}
export interface BillTo { name: string; contactName: string | null; address: string | null; email: string | null; phone: string | null; taxId: string | null; region: string | null; country?: string | null }
export interface TaxLine { label: string; amount: number }
export interface Invoice extends InvoiceSummary {
  billTo: BillTo;
  placeOfSupply: string | null;
  notes: string | null;
  customFields: Record<string, string>;
  subtotal: number;
  taxTotal: number;
  taxBreakdown: TaxLine[];
  /** The live template while a draft; the copy frozen at issue afterwards. */
  template: RenderTemplate;
  issuedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  lines: InvoiceLine[];
  createdAt: string;
}
export interface InvoiceLineInput { itemCode?: string; hsnSac?: string; unit?: string; description: string; quantity: number; unitPrice: number; taxRate?: number }
export interface InvoiceInput {
  clientKey: string;
  templateKey?: string;
  issueDate?: string;
  dueDate?: string;
  placeOfSupply?: string;
  notes?: string;
  customFields?: Record<string, string>;
  lines: InvoiceLineInput[];
}
export interface Payment {
  receiptNumber: string;
  invoiceReference: string;
  invoiceNumber: string | null;
  clientKey: string;
  clientName: string;
  amount: number;
  currency: string;
  paymentDate: string;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}
export interface PaymentInput { amount: number; paymentDate: string; method: PaymentMethod; reference?: string; notes?: string }
export interface CurrencyTotals {
  currency: string;
  outstanding: number;
  overdue: number;
  invoicedThisMonth: number;
  collectedThisMonth: number;
  aging: { current: number; days1To30: number; days31To60: number; days61To90: number; over90: number };
}
export interface BillingSummary {
  asOf: string;
  draftInvoices: number;
  openInvoices: number;
  overdueInvoices: number;
  paidInvoices: number;
  activeClients: number;
  totals: CurrencyTotals[];
}
export interface InvoiceFilter { status?: InvoiceStatus; clientKey?: string; search?: string; overdue?: boolean; page?: number; size?: number }

const invoicePath = (number: string) => `/api/finance/invoices/${encodeURIComponent(number)}`;

export const getBillingSummary = () => apiRequest<BillingSummary>("/api/finance/summary");
export const getClients = () => apiRequest<BillingClient[]>("/api/finance/clients");
export const getClient = (clientKey: string) => apiRequest<BillingClient>(`/api/finance/clients/${encodeURIComponent(clientKey)}`);
export const createClient = (body: ClientInput) => apiRequest<BillingClient>("/api/finance/clients", { method: "POST", body });
export const updateClient = (clientKey: string, body: Partial<ClientInput> & { status?: ClientStatus }) =>
  apiRequest<BillingClient>(`/api/finance/clients/${encodeURIComponent(clientKey)}`, { method: "PATCH", body });
export function getInvoices(filter: InvoiceFilter = {}) {
  const query = new URLSearchParams({ page: String(filter.page ?? 0), size: String(filter.size ?? 20) });
  if (filter.status) query.set("status", filter.status);
  if (filter.clientKey) query.set("clientKey", filter.clientKey);
  if (filter.search) query.set("search", filter.search);
  if (filter.overdue) query.set("overdue", "true");
  return apiRequest<Page<InvoiceSummary>>(`/api/finance/invoices?${query}`);
}
export const getInvoice = (number: string) => apiRequest<Invoice>(invoicePath(number));
export const createInvoice = (body: InvoiceInput) => apiRequest<Invoice>("/api/finance/invoices", { method: "POST", body });
export const updateInvoice = (number: string, body: InvoiceInput) => apiRequest<Invoice>(invoicePath(number), { method: "PUT", body });
export const issueInvoice = (number: string) => apiRequest<Invoice>(`${invoicePath(number)}/issue`, { method: "POST" });
export const voidInvoice = (number: string, reason: string) => apiRequest<Invoice>(`${invoicePath(number)}/void`, { method: "POST", body: { reason } });
export const getInvoicePayments = (number: string) => apiRequest<Payment[]>(`${invoicePath(number)}/payments`);
export const recordPayment = (number: string, body: PaymentInput) => apiRequest<Payment>(`${invoicePath(number)}/payments`, { method: "POST", body });
export type TemplateLayout = "MODERN" | "CLASSIC" | "MINIMAL";
export type TaxMode = "NONE" | "SIMPLE" | "GST";
export type FieldType = "TEXT" | "DATE" | "NUMBER";
export type DateStyle = "ORDINAL" | "MEDIUM" | "NUMERIC";
export interface LabelledValue { label: string; value: string }
export interface CustomField { key: string; label: string; type: FieldType; required?: boolean }
/** A subscriber's bill format. Every section is present in responses; requests may omit any of them. */
export interface TemplateConfig {
  branding: { logo?: string | null; primaryColor: string; accentColor: string };
  seller: { legalName?: string | null; tagline?: string | null; subline?: string | null; address?: string | null; phone?: string | null; email?: string | null; website?: string | null; region?: string | null; identifiers: LabelledValue[] };
  document: { title: string; subtitle?: string | null; copyLabel?: string | null; detailsTitle: string };
  numbering: { pattern: string; padding: number; fiscalYearStartMonth: number };
  tax: { mode: TaxMode; label: string };
  columns: { showItemCode: boolean; itemCodeLabel: string; showHsnSac?: boolean };
  customFields: CustomField[];
  paymentDetails: LabelledValue[];
  terms: string[];
  defaultNotes?: string | null;
  signatory: { name?: string | null; title?: string | null; signatureImage?: string | null };
  footerNote?: string | null;
  showAmountInWords: boolean;
  dateStyle: DateStyle;
}
export interface RenderTemplate { templateKey: string | null; name: string; layout: TemplateLayout; config: TemplateConfig }
export interface InvoiceTemplate {
  templateKey: string;
  name: string;
  layout: TemplateLayout;
  isDefault: boolean;
  status: "ACTIVE" | "ARCHIVED";
  config: TemplateConfig;
  /** The number the next invoice issued today would receive. */
  nextNumber: string;
  createdAt: string;
  updatedAt: string;
}
export interface TemplateInput { templateKey?: string; name: string; layout: TemplateLayout; config: TemplateConfig; makeDefault?: boolean }

const templatePath = (key: string) => `/api/finance/templates/${encodeURIComponent(key)}`;
export const getTemplates = () => apiRequest<InvoiceTemplate[]>("/api/finance/templates");
export const getTemplate = (key: string) => apiRequest<InvoiceTemplate>(templatePath(key));
export const createTemplate = (body: TemplateInput) => apiRequest<InvoiceTemplate>("/api/finance/templates", { method: "POST", body });
export const updateTemplate = (key: string, body: Partial<Omit<TemplateInput, "templateKey" | "makeDefault">> & { status?: "ACTIVE" | "ARCHIVED" }) =>
  apiRequest<InvoiceTemplate>(templatePath(key), { method: "PUT", body });
export const makeDefaultTemplate = (key: string) => apiRequest<InvoiceTemplate>(`${templatePath(key)}/default`, { method: "POST" });
export const getNextNumber = (key: string, date: string) =>
  apiRequest<{ number: string }>(`${templatePath(key)}/next-number?date=${encodeURIComponent(date)}`);

/** Mirrors the service's numbering so the template editor can show an example before saving. */
export function renderNumber(numbering: TemplateConfig["numbering"], date: string, serial: number): string {
  const [year, month] = date.split("-").map(Number);
  const start = numbering.fiscalYearStartMonth === 1 ? year : month >= numbering.fiscalYearStartMonth ? year : year - 1;
  const two = (value: number) => String(value % 100).padStart(2, "0");
  const fiscal = numbering.fiscalYearStartMonth === 1 ? String(year) : `${two(start)}-${two(start + 1)}`;
  return numbering.pattern.replace("{SEQ}", String(serial).padStart(numbering.padding, "0")).replace("{FY}", fiscal)
    .replace("{YYYY}", String(year)).replace("{YY}", two(year)).replace("{MM}", String(month).padStart(2, "0"));
}

export const getPayments = (page = 0, size = 20) => apiRequest<Page<Payment>>(`/api/finance/payments?page=${page}&size=${size}`);

/** Line amounts as the service calculates them: round the subtotal and the tax separately, half up, to cents. */
export function lineAmounts(line: { quantity: number; unitPrice: number; taxRate?: number }) {
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const subtotal = round((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0));
  const tax = round(subtotal * (Number(line.taxRate) || 0) / 100);
  return { subtotal, tax, total: round(subtotal + tax) };
}

// ---------------------------------------------------------------- items and services registry

export type ItemKind = "SERVICE" | "GOODS";
export interface BillableItem {
  itemCode: string;
  name: string;
  description: string | null;
  kind: ItemKind;
  category: string | null;
  hsnSac: string | null;
  unit: string | null;
  unitPrice: number | null;
  taxRate: number | null;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
}
export interface ItemInput {
  itemCode?: string; codePrefix?: string; name: string; description?: string; kind?: ItemKind; category?: string;
  hsnSac?: string; unit?: string; unitPrice?: number; taxRate?: number;
}
const itemPath = (code: string) => `/api/finance/items/${encodeURIComponent(code)}`;
export const getItems = () => apiRequest<BillableItem[]>("/api/finance/items");
export const getItem = (code: string) => apiRequest<BillableItem>(itemPath(code));
export const createItem = (body: ItemInput) => apiRequest<BillableItem>("/api/finance/items", { method: "POST", body });
export const updateItem = (code: string, body: Partial<ItemInput> & { status?: ClientStatus; clearUnitPrice?: boolean; clearTaxRate?: boolean }) =>
  apiRequest<BillableItem>(itemPath(code), { method: "PATCH", body });
export const getNextItemCode = (prefix: string) => apiRequest<{ code: string }>(`/api/finance/items/next-code?prefix=${encodeURIComponent(prefix)}`);

// ---------------------------------------------------------------- books

export type LedgerAccount = "RECEIVABLES" | "SALES" | "OUTPUT_CGST" | "OUTPUT_SGST" | "OUTPUT_IGST" | "OUTPUT_TAX" | "BANK" | "CASH";
export type VoucherType = "INVOICE" | "RECEIPT" | "INVOICE_VOID";
export const ledgerAccounts: { value: LedgerAccount; label: string }[] = [
  { value: "RECEIVABLES", label: "Accounts receivable" }, { value: "SALES", label: "Sales" }, { value: "OUTPUT_CGST", label: "Output CGST" },
  { value: "OUTPUT_SGST", label: "Output SGST" }, { value: "OUTPUT_IGST", label: "Output IGST" }, { value: "OUTPUT_TAX", label: "Output tax" },
  { value: "BANK", label: "Bank" }, { value: "CASH", label: "Cash" },
];
export const voucherLabels: Record<VoucherType, string> = { INVOICE: "Invoice", RECEIPT: "Receipt", INVOICE_VOID: "Invoice voided" };
export interface BookSettings { fiscalYearStartMonth: number; booksLockedUntil: string | null; currentFiscalYear: string }
export interface FiscalYearOption { label: string; start: string; end: string; current: boolean }
export interface MonthRow {
  month: string; start: string; end: string; invoicesIssued: number; invoicesVoided: number; taxable: number; cgst: number; sgst: number;
  igst: number; otherTax: number; invoiced: number; collected: number; closingReceivables: number;
}
export interface CurrencySummary { currency: string; openingReceivables: number; months: MonthRow[]; total: MonthRow; closingReceivables: number }
export interface YearSummary { fiscalYear: string; start: string; end: string; booksLockedUntil: string | null; currencies: CurrencySummary[] }
export interface SalesRegisterRow {
  date: string; voucherType: VoucherType; invoiceNumber: string; reference: string; clientKey: string; clientName: string; clientTaxId: string | null;
  placeOfSupply: string | null; currency: string; taxable: number; cgst: number; sgst: number; igst: number; otherTax: number; total: number;
}
export interface RegisterTotal { currency: string; invoices: number; taxable: number; cgst: number; sgst: number; igst: number; otherTax: number; total: number }
export interface SalesRegister { fiscalYear: string; month: string | null; rows: SalesRegisterRow[]; totals: RegisterTotal[] }
export interface JournalLine {
  date: string; voucherType: VoucherType; voucherNumber: string; invoiceReference: string; clientKey: string; clientName: string;
  account: LedgerAccount; accountName: string; currency: string; debit: number; credit: number; narration: string;
}
export interface Journal { fiscalYear: string; month: string | null; content: JournalLine[]; page: number; size: number; totalElements: number; totalPages: number; totals: { currency: string; debit: number; credit: number }[] }
export interface StatementLine { date: string; voucherType: VoucherType; voucherNumber: string; invoiceReference: string; narration: string; debit: number; credit: number; balance: number }
export interface Statement {
  fiscalYear: string; start: string; end: string; clientKey: string; clientName: string;
  currencies: { currency: string; openingBalance: number; lines: StatementLine[]; totalDebit: number; totalCredit: number; closingBalance: number }[];
}
const books = (path: string, params: Record<string, string | number | undefined> = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== "").map(([key, value]) => [key, String(value)]));
  return `/api/finance/books${path}${query.size ? `?${query}` : ""}`;
};
export const getBookSettings = () => apiRequest<BookSettings>(books("/settings"));
export const updateBookSettings = (body: { fiscalYearStartMonth: number; booksLockedUntil: string | null }) => apiRequest<BookSettings>(books("/settings"), { method: "PUT", body });
export const getFiscalYears = () => apiRequest<FiscalYearOption[]>(books("/years"));
export const getYearSummary = (fy?: string) => apiRequest<YearSummary>(books("/summary", { fy }));
export const getSalesRegister = (fy?: string, month?: string) => apiRequest<SalesRegister>(books("/sales-register", { fy, month }));
export const getJournal = (filter: { fy?: string; month?: string; account?: string; clientKey?: string; page?: number; size?: number }) =>
  apiRequest<Journal>(books("/journal", filter));
export const getStatement = (clientKey: string, fy?: string) => apiRequest<Statement>(books(`/statements/${encodeURIComponent(clientKey)}`, { fy }));

/** Downloads rows as a UTF-8 CSV that Excel opens correctly. */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const cell = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
