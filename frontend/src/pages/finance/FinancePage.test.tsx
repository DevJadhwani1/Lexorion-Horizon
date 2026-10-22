import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { FinancePage, addDays, localToday } from "./FinancePage";
import * as financeApi from "../../features/finance/financeApi";

vi.mock("../../auth/AuthProvider", () => ({ useAuth: () => ({ organization: { organizationId: "org", membershipRole: "ADMIN" } }) }));
vi.mock("../../features/admin/adminApi", async (load) => ({ ...(await load<typeof import("../../features/admin/adminApi")>()), getOrganization: vi.fn(async () => ({ settings: { currency: "INR", locale: "en-IN" } })) }));
vi.mock("../../workspace/WorkspaceProvider", () => ({ useWorkspace: () => ({ workspace: { key: "books", displayName: "Books", products: [{ key: "finance" }] } }) }));
vi.mock("../../features/finance/financeApi", async (load) => {
  const actual = await load<typeof import("../../features/finance/financeApi")>();
  return { ...actual, getClients: vi.fn(), createInvoice: vi.fn(), getInvoice: vi.fn(), getInvoicePayments: vi.fn(), issueInvoice: vi.fn(), recordPayment: vi.fn(), getBillingSummary: vi.fn(), getInvoices: vi.fn() };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });

function CurrentLocation() { const location = useLocation(); return <output>{location.pathname}</output>; }

const client: financeApi.BillingClient = { clientKey: "meridian", displayName: "Meridian Logistics", email: "ap@meridian.test", phone: null, billingAddress: "12 Dock Road\nMumbai", taxId: "27AAAAA0000A1Z5", currency: "INR", paymentTermsDays: 15, status: "ACTIVE", outstandingAmount: 0, openInvoices: 0, createdAt: "", updatedAt: "" };
const invoice: financeApi.Invoice = {
  invoiceNumber: "INV-00001", clientKey: "meridian", clientName: "Meridian Logistics", clientEmail: "ap@meridian.test", clientBillingAddress: "12 Dock Road", clientTaxId: null,
  status: "DRAFT", overdue: false, currency: "INR", issueDate: "2026-10-20", dueDate: "2026-11-04", notes: null, subtotal: 1000, taxTotal: 180, total: 1180, amountPaid: 0, balanceDue: 1180,
  issuedAt: null, voidedAt: null, voidReason: null, createdAt: "", updatedAt: "",
  lines: [{ lineNumber: 1, description: "Placement fee", quantity: 1, unitPrice: 1000, taxRate: 18, subtotal: 1000, taxAmount: 180, total: 1180 }],
};

describe("Finance billing workspace", () => {
  it("calculates line amounts the same way as the service", () => {
    expect(financeApi.lineAmounts({ quantity: 3, unitPrice: 1500.5 })).toEqual({ subtotal: 4501.5, tax: 0, total: 4501.5 });
    expect(financeApi.lineAmounts({ quantity: 1, unitPrice: 99.99, taxRate: 18 })).toEqual({ subtotal: 99.99, tax: 18, total: 117.99 });
    expect(addDays("2026-10-20", 15)).toBe("2026-11-04");
    expect(localToday(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("drafts an invoice with live totals and opens it after saving", async () => {
    vi.mocked(financeApi.getClients).mockResolvedValue([client]);
    vi.mocked(financeApi.createInvoice).mockResolvedValue(invoice);
    vi.mocked(financeApi.getInvoice).mockResolvedValue(invoice);
    vi.mocked(financeApi.getInvoicePayments).mockResolvedValue([]);
    render(<MemoryRouter initialEntries={["/app/finance/invoices/new?client=meridian"]}><CurrentLocation /><Routes>
      <Route path="/app/finance/invoices/new" element={<FinancePage sectionKey="new-invoice" />} />
      <Route path="/app/finance/invoices/:invoiceNumber" element={<FinancePage sectionKey="invoice" />} />
    </Routes></MemoryRouter>);
    await screen.findByRole("option", { name: "Meridian Logistics (INR)" });
    fireEvent.change(screen.getByLabelText("Invoice date"), { target: { value: "2026-10-20" } });
    expect(screen.getByText(/from Meridian Logistics's 15-day payment terms/).textContent).toContain("4 Nov 2026");
    fireEvent.change(screen.getByLabelText("Line 1 description"), { target: { value: "Placement fee" } });
    fireEvent.change(screen.getByLabelText("Line 1 unit price"), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText("Line 1 tax rate"), { target: { value: "18" } });
    const totals = screen.getByLabelText("Invoice totals");
    await waitFor(() => expect(totals.textContent).toContain("1,180.00"));
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("/app/finance/invoices/INV-00001"));
    expect(financeApi.createInvoice).toHaveBeenCalledWith({ clientKey: "meridian", issueDate: "2026-10-20", dueDate: undefined, notes: undefined,
      lines: [{ description: "Placement fee", quantity: 1, unitPrice: 1000, taxRate: 18 }] });
    await screen.findByRole("button", { name: "Issue invoice" });
  });

  it("issues a draft and records a payment against the balance", async () => {
    const issued = { ...invoice, status: "ISSUED" as const, issuedAt: "2026-10-20T10:00:00Z" };
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(financeApi.getInvoice).mockResolvedValueOnce(invoice).mockResolvedValueOnce(issued)
      .mockResolvedValue({ ...issued, status: "PARTIALLY_PAID", amountPaid: 500, balanceDue: 680 });
    vi.mocked(financeApi.getInvoicePayments).mockResolvedValue([]);
    vi.mocked(financeApi.issueInvoice).mockResolvedValue(issued);
    vi.mocked(financeApi.recordPayment).mockResolvedValue({ receiptNumber: "RCPT-00001", invoiceNumber: "INV-00001", clientKey: "meridian", clientName: "Meridian Logistics", amount: 500, currency: "INR", paymentDate: "2026-10-21", method: "UPI", reference: null, notes: null, createdAt: "" });
    render(<MemoryRouter initialEntries={["/app/finance/invoices/INV-00001"]}><Routes>
      <Route path="/app/finance/invoices/:invoiceNumber" element={<FinancePage sectionKey="invoice" />} />
    </Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Issue invoice" }));
    await waitFor(() => expect(financeApi.issueInvoice).toHaveBeenCalledWith("INV-00001"));
    fireEvent.click(await screen.findByRole("button", { name: "Record payment" }));
    const amount = screen.getByLabelText("Amount (INR)") as HTMLInputElement;
    expect(amount.value).toBe("1180");
    fireEvent.change(amount, { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Payment date"), { target: { value: "2026-10-21" } });
    fireEvent.change(screen.getByLabelText("Method"), { target: { value: "UPI" } });
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));
    await waitFor(() => expect(financeApi.recordPayment).toHaveBeenCalledWith("INV-00001", { amount: 500, paymentDate: "2026-10-21", method: "UPI", reference: undefined, notes: undefined }));
    await screen.findByText("Partially paid");
  });

  it("summarizes receivables and lists overdue invoices that need attention", async () => {
    vi.mocked(financeApi.getBillingSummary).mockResolvedValue({ asOf: "2026-10-22", draftInvoices: 0, openInvoices: 1, overdueInvoices: 1, paidInvoices: 2, activeClients: 1,
      totals: [{ currency: "INR", outstanding: 8400, overdue: 8400, invoicedThisMonth: 0, collectedThisMonth: 1200, aging: { current: 0, days1To30: 0, days31To60: 8400, days61To90: 0, over90: 0 } }] });
    const overdue = { ...invoice, status: "ISSUED" as const, overdue: true, total: 8400, balanceDue: 8400 };
    vi.mocked(financeApi.getInvoices).mockImplementation(async (filter = {}) => ({ content: filter.overdue ? [overdue] : [], page: 0, size: 5, totalElements: filter.overdue ? 1 : 0, totalPages: 1, sort: "createdAt", direction: "desc" }));
    render(<MemoryRouter><FinancePage sectionKey="overview" /></MemoryRouter>);
    expect(await screen.findByText("Needs attention")).toBeTruthy();
    expect(screen.getByRole("link", { name: "INV-00001" })).toBeTruthy();
    expect(screen.getByText("Overdue", { selector: ".badge" })).toBeTruthy();
    expect(screen.getByText("1 past due date")).toBeTruthy();
  });
});
