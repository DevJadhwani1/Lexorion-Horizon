import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { FinancePage, addDays, localToday } from "./FinancePage";
import { TemplatesPage } from "./TemplatesPage";
import { InvoiceDocument, documentDate } from "./InvoiceDocument";
import * as financeApi from "../../features/finance/financeApi";
import { blankTemplateConfig, fieldKey, templatePresets } from "../../features/finance/templatePresets";
import { chooseOption } from "../../test/dropdown";

vi.mock("../../auth/AuthProvider", () => ({ useAuth: () => ({ organization: { organizationId: "org", organizationName: "Omega Hires", membershipRole: "ADMIN" } }) }));
vi.mock("../../features/admin/adminApi", async (load) => ({ ...(await load<typeof import("../../features/admin/adminApi")>()), getOrganization: vi.fn(async () => ({ settings: { currency: "INR", locale: "en-IN" } })) }));
vi.mock("../../workspace/WorkspaceProvider", () => ({ useWorkspace: () => ({ workspace: { key: "books", displayName: "Books", products: [{ key: "finance" }] } }) }));
vi.mock("../../features/finance/financeApi", async (load) => {
  const actual = await load<typeof import("../../features/finance/financeApi")>();
  return { ...actual, getClients: vi.fn(), getTemplates: vi.fn(), createTemplate: vi.fn(), createInvoice: vi.fn(), getInvoice: vi.fn(), getInvoicePayments: vi.fn(), getNextNumber: vi.fn(), issueInvoice: vi.fn(), recordPayment: vi.fn(), getBillingSummary: vi.fn(), getInvoices: vi.fn() };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });

function CurrentLocation() { const location = useLocation(); return <output>{location.pathname}</output>; }

const recruitment: financeApi.TemplateConfig = {
  ...templatePresets.find((preset) => preset.key === "recruitment")!.apply(blankTemplateConfig()),
  seller: { legalName: "Omega Hires India Private Limited", tagline: "Executive recruitment", region: "Maharashtra", identifiers: [{ label: "GSTIN", value: "27AAECO677261ZF" }] },
  numbering: { pattern: "OH/{FY}/{SEQ}", padding: 4, fiscalYearStartMonth: 4 },
  paymentDetails: [{ label: "Bank", value: "ICICI Bank" }],
  signatory: { name: "Shumbham Arun Rai", title: "Authorised signatory" },
};
const template: financeApi.InvoiceTemplate = { templateKey: "recruitment", name: "Recruitment", layout: "MODERN", isDefault: true, status: "ACTIVE", config: recruitment, nextNumber: "OH/26-27/0001", createdAt: "", updatedAt: "" };
const client: financeApi.BillingClient = { clientKey: "mastek", displayName: "Mastek Limited", contactName: "Ramya Chandran", email: "ap@mastek.test", phone: null, billingAddress: "Mahape", taxId: "27AAACM9908Q2ZP", region: "Maharashtra", currency: "INR", paymentTermsDays: 30, status: "ACTIVE", outstandingAmount: 0, openInvoices: 0, createdAt: "", updatedAt: "" };
const draft: financeApi.Invoice = {
  reference: "REF-00001", invoiceNumber: null, clientKey: "mastek", clientName: "Mastek Limited",
  billTo: { name: "Mastek Limited", contactName: "Ramya Chandran", address: "Mahape", email: null, phone: null, taxId: "27AAACM9908Q2ZP", region: "Maharashtra" },
  status: "DRAFT", overdue: false, currency: "INR", issueDate: "2026-05-30", dueDate: "2026-06-29", placeOfSupply: "Maharashtra", notes: null,
  customFields: { candidate: "Saksham Jain", joiningDate: "2026-04-10" }, subtotal: 180000, taxTotal: 32400, total: 212400, amountPaid: 0, balanceDue: 212400,
  taxBreakdown: [{ label: "CGST", amount: 16200 }, { label: "SGST", amount: 16200 }], issuedAt: null, voidedAt: null, voidReason: null, createdAt: "", updatedAt: "",
  template: { templateKey: "recruitment", name: "Recruitment", layout: "MODERN", config: recruitment },
  lines: [{ lineNumber: 1, itemCode: "REC-001", description: "Recruitment fee — Saksham Jain", quantity: 1, unitPrice: 180000, taxRate: 18, subtotal: 180000, taxAmount: 32400, total: 212400 }],
};

describe("Finance helpers", () => {
  it("calculates amounts, dates, field keys and numbers like the service", () => {
    expect(financeApi.lineAmounts({ quantity: 1, unitPrice: 99.99, taxRate: 18 })).toEqual({ subtotal: 99.99, tax: 18, total: 117.99 });
    expect(addDays("2026-10-20", 15)).toBe("2026-11-04");
    expect(localToday(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(documentDate("2026-05-30", "ORDINAL")).toBe("30th May 2026");
    expect(documentDate("2026-06-22", "ORDINAL")).toBe("22nd June 2026");
    expect(documentDate("2026-06-11", "NUMERIC")).toBe("11/06/2026");
    expect(fieldKey("Joining date")).toBe("joiningDate");
    expect(fieldKey("PO number")).toBe("poNumber");
    expect(financeApi.renderNumber(recruitment.numbering, "2026-05-30", 1)).toBe("OH/26-27/0001");
    expect(financeApi.renderNumber(recruitment.numbering, "2027-03-31", 12)).toBe("OH/26-27/0012");
    expect(financeApi.renderNumber({ pattern: "{YYYY}-{MM}-{SEQ}", padding: 3, fiscalYearStartMonth: 1 }, "2027-04-02", 7)).toBe("2027-04-007");
  });
});

describe("Invoice document", () => {
  it("renders the template: seller, buyer, industry fields, GST split and amount in words", () => {
    render(<InvoiceDocument data={{ ...draft, number: "OH/26-27/0001", status: "ISSUED" }} template={draft.template} />);
    const bill = screen.getByRole("article", { name: "Invoice OH/26-27/0001" });
    const text = bill.textContent ?? "";
    expect(text).toContain("Omega Hires India Private Limited");
    expect(text).toContain("27AAECO677261ZF");
    expect(text).toContain("Ramya Chandran");
    expect(within(bill).getByLabelText("Recruitment engagement").textContent).toContain("Saksham Jain");
    expect(text).toContain("10th April 2026");
    expect(text).toContain("CGST");
    expect(text).toContain("₹2,12,400.00");
    expect(text).toContain("Rupees Two Lakh Twelve Thousand Four Hundred Only");
    expect(text).toContain("Shumbham Arun Rai");
    expect(text).not.toContain("Draft");
  });
});

describe("Finance billing workspace", () => {
  it("drafts an invoice on the default template with its industry fields and opens it", async () => {
    vi.mocked(financeApi.getClients).mockResolvedValue([client]);
    vi.mocked(financeApi.getTemplates).mockResolvedValue([template]);
    vi.mocked(financeApi.createInvoice).mockResolvedValue(draft);
    vi.mocked(financeApi.getInvoice).mockResolvedValue(draft);
    vi.mocked(financeApi.getInvoicePayments).mockResolvedValue([]);
    vi.mocked(financeApi.getNextNumber).mockResolvedValue({ number: "OH/26-27/0001" });
    render(<MemoryRouter initialEntries={["/app/finance/invoices/new?client=mastek"]}><CurrentLocation /><Routes>
      <Route path="/app/finance/invoices/new" element={<FinancePage sectionKey="new-invoice" />} />
      <Route path="/app/finance/invoices/:reference" element={<FinancePage sectionKey="invoice" />} />
    </Routes></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText("Candidate *"), { target: { value: "Saksham Jain" } });
    fireEvent.change(screen.getByLabelText("Joining date"), { target: { value: "2026-04-10" } });
    fireEvent.change(screen.getByLabelText("Invoice date"), { target: { value: "2026-05-30" } });
    fireEvent.change(screen.getByLabelText("Line 1 Code"), { target: { value: "REC-001" } });
    fireEvent.change(screen.getByLabelText("Line 1 description"), { target: { value: "Recruitment fee" } });
    fireEvent.change(screen.getByLabelText("Line 1 unit price"), { target: { value: "180000" } });
    fireEvent.change(screen.getByLabelText("Line 1 tax rate"), { target: { value: "18" } });
    await waitFor(() => expect(screen.getByLabelText("Invoice totals").textContent).toContain("2,12,400.00"));
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("/app/finance/invoices/REF-00001"));
    expect(financeApi.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      clientKey: "mastek", templateKey: "recruitment", issueDate: "2026-05-30", customFields: { candidate: "Saksham Jain", joiningDate: "2026-04-10" },
      lines: [{ itemCode: "REC-001", description: "Recruitment fee", quantity: 1, unitPrice: 180000, taxRate: 18 }],
    }));
    expect(await screen.findByText("OH/26-27/0001", { selector: "strong" })).toBeTruthy();
    expect(screen.getByRole("article", { name: "Invoice draft" })).toBeTruthy();
  });

  it("issues a draft and records a payment against the balance", async () => {
    const issued = { ...draft, invoiceNumber: "OH/26-27/0001", status: "ISSUED" as const };
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(financeApi.getInvoice).mockResolvedValueOnce(draft).mockResolvedValueOnce(issued)
      .mockResolvedValue({ ...issued, status: "PARTIALLY_PAID", amountPaid: 12400, balanceDue: 200000 });
    vi.mocked(financeApi.getInvoicePayments).mockResolvedValue([]);
    vi.mocked(financeApi.getNextNumber).mockResolvedValue({ number: "OH/26-27/0001" });
    vi.mocked(financeApi.issueInvoice).mockResolvedValue(issued);
    vi.mocked(financeApi.recordPayment).mockResolvedValue({ receiptNumber: "RCPT-00001", invoiceReference: "REF-00001", invoiceNumber: "OH/26-27/0001", clientKey: "mastek", clientName: "Mastek Limited", amount: 12400, currency: "INR", paymentDate: "2026-06-01", method: "UPI", reference: null, notes: null, createdAt: "" });
    render(<MemoryRouter initialEntries={["/app/finance/invoices/REF-00001"]}><Routes>
      <Route path="/app/finance/invoices/:reference" element={<FinancePage sectionKey="invoice" />} />
    </Routes></MemoryRouter>);
    await screen.findByText(/It will be numbered/);
    fireEvent.click(screen.getByRole("button", { name: "Issue invoice" }));
    await waitFor(() => expect(financeApi.issueInvoice).toHaveBeenCalledWith("REF-00001"));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("as OH/26-27/0001"));
    fireEvent.click(await screen.findByRole("button", { name: "Record payment" }));
    fireEvent.change(screen.getByLabelText("Amount (INR)"), { target: { value: "12400" } });
    fireEvent.change(screen.getByLabelText("Payment date"), { target: { value: "2026-06-01" } });
    chooseOption("Method", "Upi");
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));
    await waitFor(() => expect(financeApi.recordPayment).toHaveBeenCalledWith("REF-00001", { amount: 12400, paymentDate: "2026-06-01", method: "UPI", reference: undefined, notes: undefined }));
    await screen.findByText(/Partially paid/);
  });

  it("summarizes receivables and suggests designing a template", async () => {
    vi.mocked(financeApi.getBillingSummary).mockResolvedValue({ asOf: "2026-10-22", draftInvoices: 0, openInvoices: 1, overdueInvoices: 1, paidInvoices: 2, activeClients: 1,
      totals: [{ currency: "INR", outstanding: 8400, overdue: 8400, invoicedThisMonth: 0, collectedThisMonth: 1200, aging: { current: 0, days1To30: 0, days31To60: 8400, days61To90: 0, over90: 0 } }] });
    vi.mocked(financeApi.getTemplates).mockResolvedValue([]);
    const overdue = { ...draft, invoiceNumber: "INV-00001", status: "ISSUED" as const, overdue: true, total: 8400, balanceDue: 8400 };
    vi.mocked(financeApi.getInvoices).mockImplementation(async (filter = {}) => ({ content: filter.overdue ? [overdue] : [], page: 0, size: 5, totalElements: filter.overdue ? 1 : 0, totalPages: 1, sort: "createdAt", direction: "desc" }));
    render(<MemoryRouter><FinancePage sectionKey="overview" /></MemoryRouter>);
    expect(await screen.findByText("Needs attention")).toBeTruthy();
    expect(screen.getByRole("link", { name: "INV-00001" }).getAttribute("href")).toBe("/app/finance/invoices/REF-00001");
    expect(screen.getByRole("link", { name: "Design your own invoice template" })).toBeTruthy();
  });
});

describe("Invoice templates", () => {
  it("starts from an industry preset, previews edits live and saves the template", async () => {
    vi.mocked(financeApi.createTemplate).mockResolvedValue({ ...template, templateKey: "recruitment-staffing-invoice" });
    render(<MemoryRouter initialEntries={["/app/finance/templates/new"]}><CurrentLocation /><Routes>
      <Route path="/app/finance/templates/new" element={<TemplatesPage section="new" />} />
      <Route path="/app/finance/templates/:templateKey" element={<p>saved</p>} />
    </Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Recruitment & staffing/ }));
    const preview = screen.getByRole("region", { name: "Preview" });
    expect(within(preview).getByLabelText("Recruitment engagement").textContent).toContain("Sample candidate");
    fireEvent.change(screen.getByLabelText("Legal name"), { target: { value: "Omega Hires India Private Limited" } });
    fireEvent.change(screen.getByLabelText("Pattern"), { target: { value: "OH/{FY}/{SEQ}" } });
    expect(preview.textContent).toContain("Omega Hires India Private Limited");
    expect(screen.getByText(/Example:/).textContent).toMatch(/OH\/\d\d-\d\d\/0001/);
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    const labels = screen.getAllByLabelText("Field label");
    fireEvent.change(labels[labels.length - 1], { target: { value: "Offer CTC" } });
    fireEvent.click(screen.getByRole("button", { name: /^Classic/ }));
    expect(preview.querySelector(".invoice-doc--classic")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create template" }));
    await waitFor(() => expect(financeApi.createTemplate).toHaveBeenCalled());
    const body = vi.mocked(financeApi.createTemplate).mock.calls[0][0];
    expect(body.layout).toBe("CLASSIC");
    expect(body.config.seller.legalName).toBe("Omega Hires India Private Limited");
    expect(body.config.numbering.pattern).toBe("OH/{FY}/{SEQ}");
    expect(body.config.tax.mode).toBe("GST");
    expect(body.config.customFields.map((field) => field.key)).toEqual(["candidate", "position", "joiningDate", "offerCtc"]);
    expect(body.config.seller.identifiers).toEqual([]);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("/app/finance/templates/recruitment-staffing-invoice"));
  });
});
