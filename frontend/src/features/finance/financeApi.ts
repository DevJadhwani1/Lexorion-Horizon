import { apiRequest } from "../../api/httpClient";
import type { Page } from "../../api/types";

export type ClientStatus = "ACTIVE" | "ARCHIVED";
export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";
export type PaymentMethod = "BANK_TRANSFER" | "UPI" | "CARD" | "CASH" | "CHEQUE" | "OTHER";
export const paymentMethods: PaymentMethod[] = ["BANK_TRANSFER", "UPI", "CARD", "CASH", "CHEQUE", "OTHER"];

export interface BillingClient {
  clientKey: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  taxId: string | null;
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
  email?: string;
  phone?: string;
  billingAddress?: string;
  taxId?: string;
  currency: string;
  paymentTermsDays?: number;
}
export interface InvoiceLine {
  lineNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
}
export interface InvoiceSummary {
  invoiceNumber: string;
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
export interface Invoice extends InvoiceSummary {
  clientEmail: string | null;
  clientBillingAddress: string | null;
  clientTaxId: string | null;
  notes: string | null;
  subtotal: number;
  taxTotal: number;
  issuedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  lines: InvoiceLine[];
  createdAt: string;
}
export interface InvoiceLineInput { description: string; quantity: number; unitPrice: number; taxRate?: number }
export interface InvoiceInput {
  clientKey: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  lines: InvoiceLineInput[];
}
export interface Payment {
  receiptNumber: string;
  invoiceNumber: string;
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
export interface InvoiceFilter { status?: InvoiceStatus; clientKey?: string; overdue?: boolean; page?: number; size?: number }

const invoicePath = (number: string) => `/api/finance/invoices/${encodeURIComponent(number)}`;

export const getBillingSummary = () => apiRequest<BillingSummary>("/api/finance/summary");
export const getClients = () => apiRequest<BillingClient[]>("/api/finance/clients");
export const createClient = (body: ClientInput) => apiRequest<BillingClient>("/api/finance/clients", { method: "POST", body });
export const updateClient = (clientKey: string, body: Partial<ClientInput> & { status?: ClientStatus }) =>
  apiRequest<BillingClient>(`/api/finance/clients/${encodeURIComponent(clientKey)}`, { method: "PATCH", body });
export function getInvoices(filter: InvoiceFilter = {}) {
  const query = new URLSearchParams({ page: String(filter.page ?? 0), size: String(filter.size ?? 20) });
  if (filter.status) query.set("status", filter.status);
  if (filter.clientKey) query.set("clientKey", filter.clientKey);
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
export const getPayments = (page = 0, size = 20) => apiRequest<Page<Payment>>(`/api/finance/payments?page=${page}&size=${size}`);

/** Line amounts as the service calculates them: round the subtotal and the tax separately, half up, to cents. */
export function lineAmounts(line: { quantity: number; unitPrice: number; taxRate?: number }) {
  const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const subtotal = round((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0));
  const tax = round(subtotal * (Number(line.taxRate) || 0) / 100);
  return { subtotal, tax, total: round(subtotal + tax) };
}
