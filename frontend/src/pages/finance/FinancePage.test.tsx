import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { FinancePage, addDays, localToday } from "./FinancePage";
import { TemplatesPage } from "./TemplatesPage";
import { ClientPages } from "./ClientPages";
import { InvoiceWizardPage } from "./InvoiceWizard";
import { BooksPage } from "./BooksPages";
import { ItemPages } from "./ItemPages";
import { gstinProblem, gstinState } from "../../features/finance/billingData";
import { InvoiceDocument, documentDate, invoiceDownloadTitle, printDocument } from "./InvoiceDocument";
import * as financeApi from "../../features/finance/financeApi";
import { blankTemplateConfig, fieldKey, templatePresets } from "../../features/finance/templatePresets";
import { chooseOption } from "../../test/dropdown";

vi.mock("../../auth/AuthProvider", () => ({ useAuth: () => ({ organization: { organizationId: "org", organizationName: "Omega Hires", membershipRole: "ADMIN" } }) }));
vi.mock("../../features/admin/adminApi", async (load) => ({ ...(await load<typeof import("../../features/admin/adminApi")>()), getOrganization: vi.fn(async () => ({ settings: { currency: "INR", locale: "en-IN" } })) }));
vi.mock("../../workspace/WorkspaceProvider", () => ({ useWorkspace: () => ({ workspace: { key: "books", displayName: "Books", products: [{ key: "finance" }] } }) }));
vi.mock("../../features/finance/financeApi", async (load) => {
  const actual = await load<typeof import("../../features/finance/financeApi")>();
  return { ...actual, getClients: vi.fn(), getClient: vi.fn(), getItems: vi.fn(async () => []), getNextItemCode: vi.fn(), createItem: vi.fn(),
    getFiscalYears: vi.fn(async () => []), getYearSummary: vi.fn(), getStatement: vi.fn(), createClient: vi.fn(), updateClient: vi.fn(), getTemplates: vi.fn(), createTemplate: vi.fn(), createInvoice: vi.fn(), getInvoice: vi.fn(), getInvoicePayments: vi.fn(), getNextNumber: vi.fn(), issueInvoice: vi.fn(), recordPayment: vi.fn(), getBillingSummary: vi.fn(), getInvoices: vi.fn(), getPayments: vi.fn(), createReceipt: vi.fn(), allocateReceipt: vi.fn() };
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
const client: financeApi.BillingClient = { clientKey: "mastek", displayName: "Mastek Limited", contactName: "Ramya Chandran", email: "ap@mastek.test", phone: null, billingAddress: "Mahape", taxId: "27AAACM9908Q2ZP", region: "Maharashtra", country: "IN", currency: "INR", paymentTermsDays: 30, status: "ACTIVE", outstandingAmount: 0, openInvoices: 0, createdAt: "", updatedAt: "" };
const draft: financeApi.Invoice = {
  reference: "REF-00001", invoiceNumber: null, clientKey: "mastek", clientName: "Mastek Limited",
  billTo: { name: "Mastek Limited", contactName: "Ramya Chandran", address: "Mahape", email: null, phone: null, taxId: "27AAACM9908Q2ZP", region: "Maharashtra" },
  status: "DRAFT", overdue: false, currency: "INR", issueDate: "2026-05-30", dueDate: "2026-06-29", placeOfSupply: "Maharashtra", notes: null,
  customFields: { candidate: "Saksham Jain", joiningDate: "2026-04-10" }, subtotal: 180000, taxTotal: 32400, total: 212400, amountPaid: 0, balanceDue: 212400,
  taxBreakdown: [{ label: "CGST", amount: 16200 }, { label: "SGST", amount: 16200 }], issuedAt: null, voidedAt: null, voidReason: null, createdAt: "", updatedAt: "",
  template: { templateKey: "recruitment", name: "Recruitment", layout: "MODERN", config: recruitment },
  lines: [{ lineNumber: 1, itemCode: "REC-001", hsnSac: "998512", unit: null, description: "Recruitment fee — Saksham Jain", quantity: 1, unitPrice: 180000, taxRate: 18, subtotal: 180000, taxAmount: 32400, total: 212400 }],
};

describe("Finance helpers", () => {
  it("calculates amounts, dates, field keys and numbers like the service", () => {
    expect(financeApi.lineAmounts({ quantity: 1, unitPrice: 99.99, taxRate: 18 })).toEqual({ subtotal: 99.99, tax: 18, total: 117.99 });
    expect(addDays("2026-10-20", 15)).toBe("2026-11-04");
    expect(localToday(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(documentDate("2026-05-30", "ORDINAL")).toBe("30th May 2026");
    expect(documentDate("2026-06-22", "ORDINAL")).toBe("22nd June 2026");
    expect(documentDate("2026-06-11", "NUMERIC")).toBe("11/06/2026");
    expect(documentDate("2026-09-02", "COMPACT")).toBe("02 Sept 2026");
    expect(invoiceDownloadTitle("Omega Hires India Private Limited", "Refex Shared Services Private Limited", "OH/26-27/0014")).toBe("Omega Hires · Refex · OH-26-27-0014");
    expect(fieldKey("Joining date")).toBe("joiningDate");
    expect(fieldKey("PO number")).toBe("poNumber");
    expect(gstinState("27AAACM9908Q2ZP")).toBe("Maharashtra");
    expect(gstinState("29AAACM9908Q2ZP")).toBe("Karnataka");
    expect(gstinProblem("27AAACM9908Q2Z")).toBe("A GSTIN has 15 characters; this has 14.");
    expect(gstinProblem("99AAACM9908Q2ZP")).toBe("99 is not a GST state code.");
    expect(gstinProblem("27AAACM9908Q2ZP")).toBeNull();
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

  it("matches an issued Omega Hires bill: logo, invoice heading, short dates, and no empty HSN column", () => {
    const config: financeApi.TemplateConfig = {
      ...recruitment,
      document: { title: "TAX INVOICE", subtitle: "", copyLabel: "ORIGINAL FOR RECIPIENT", detailsTitle: "RECRUITMENT ENGAGEMENT" },
      seller: {
        ...recruitment.seller,
        phone: "+919898741457",
        website: "https://www.omegahires.com",
        identifiers: [
          { label: "GSTIN", value: "27AAECO6722G1ZF" },
          { label: "PAN", value: "AAECO6722G" },
          { label: "CIN", value: "U70200MH2025PTC444379" },
          { label: "TAN", value: "MUMO09821G" },
        ],
      },
      columns: { showItemCode: true, itemCodeLabel: "CODE", showHsnSac: true },
    };
    render(<InvoiceDocument data={{
      ...draft, number: "OH/26-27/0014", issueDate: "2026-09-02", dueDate: "2026-10-02",
      lines: [{ ...draft.lines[0], hsnSac: null, description: "T&M Offrole - Mohamed Aashik Ilahi M" }],
    }} template={{ ...draft.template, config }} />);
    const bill = screen.getByRole("article", { name: "Invoice OH/26-27/0014" });
    const text = bill.textContent ?? "";
    expect(within(bill).getByRole("heading", { level: 2 }).textContent).toBe("Invoice");
    expect(text).toContain("Tax invoice");
    expect(text).toContain("02 Sept 2026");
    expect(text).toContain("02 Oct 2026");
    expect(text).toContain("10th April 2026");
    expect(text).toContain("PAN / CIN");
    expect(text).toContain("AAECO6722G · U70200MH2025PTC444379");
    expect(text).not.toContain("HSN/SAC");
    expect(text).toContain("+91 98987 41457");
    expect(text).toContain("www.omegahires.com");
    expect(text).not.toContain("https://");
    expect(bill.querySelector(".invoice-doc-logo")?.getAttribute("src")).toBe("/omega-hires-logo.png");
  });

  it("sets the print title to the source file name before the browser saves the PDF", () => {
    vi.useFakeTimers();
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    document.title = "OH/26-27/0014 · Horizon";
    printDocument(invoiceDownloadTitle("Omega Hires India Private Limited", "VEENA CORP", "OH/26-27/0011"));
    expect(document.title).toBe("Omega Hires · VEENA · OH-26-27-0011");
    vi.runAllTimers();
    expect(print).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event("afterprint"));
    expect(document.title).toBe("OH/26-27/0014 · Horizon");
    vi.useRealTimers();
  });
});

describe("Finance billing workspace", () => {
  it("shows the bill updating beside the form through details and line items, then saves the draft", async () => {
    vi.mocked(financeApi.getClients).mockResolvedValue([client]);
    vi.mocked(financeApi.getTemplates).mockResolvedValue([template]);
    vi.mocked(financeApi.createInvoice).mockResolvedValue(draft);
    vi.mocked(financeApi.getNextNumber).mockResolvedValue({ number: "OH/26-27/0001" });
    render(<MemoryRouter initialEntries={["/finance/invoices/new?client=mastek"]}><CurrentLocation /><Routes>
      <Route path="/finance/invoices/new" element={<InvoiceWizardPage mode="new" />} />
      <Route path="/finance/invoices/:reference" element={<p>opened</p>} />
    </Routes></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "New invoice for Mastek Limited" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Invoice date"), { target: { value: "2026-05-30" } });
    expect(screen.getByText(/29 Jun 2026 from Net 30/)).toBeTruthy();
    expect(screen.getByText("Same state as yours: CGST + SGST.")).toBeTruthy();
    const bill = screen.getByRole("article", { name: "Invoice draft" });
    expect(screen.getByRole("region", { name: "Live preview" }).contains(bill)).toBe(true);
    expect(bill.textContent).toContain("Omega Hires India Private Limited");
    fireEvent.change(screen.getByLabelText("Candidate"), { target: { value: "Saksham Jain" } });
    expect(bill.textContent).toContain("Saksham Jain");
    fireEvent.change(screen.getByLabelText("Joining date"), { target: { value: "2026-04-10" } });
    expect(await screen.findByText("OH/26-27/0001")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue to line items" }));
    fireEvent.change(screen.getByLabelText("Line 1 Code"), { target: { value: "REC-001" } });
    fireEvent.change(screen.getByLabelText("Line 1 description"), { target: { value: "Recruitment fee" } });
    fireEvent.change(screen.getByLabelText("Line 1 unit price"), { target: { value: "180000" } });
    fireEvent.change(screen.getByLabelText("Line 1 tax rate"), { target: { value: "18" } });
    const totals = screen.getByLabelText("Invoice totals");
    expect(totals.textContent).toContain("CGST");
    expect(totals.textContent).toContain("2,12,400.00");
    const updated = screen.getByRole("article", { name: "Invoice draft" });
    expect(updated.textContent).toContain("REC-001");
    expect(updated.textContent).toContain("Rupees Two Lakh Twelve Thousand Four Hundred Only");
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("/finance/invoices/REF-00001"));
    expect(financeApi.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      clientKey: "mastek", templateKey: "recruitment", issueDate: "2026-05-30", customFields: { candidate: "Saksham Jain", joiningDate: "2026-04-10" },
      lines: [{ itemCode: "REC-001", hsnSac: undefined, unit: undefined, description: "Recruitment fee", quantity: 1, unitPrice: 180000, taxRate: 18 }],
    }));
    expect(financeApi.issueInvoice).not.toHaveBeenCalled();
  });

  it("asks before issuing and blocks issuing while a required field is missing", async () => {
    vi.mocked(financeApi.getClients).mockResolvedValue([client]);
    vi.mocked(financeApi.getTemplates).mockResolvedValue([template]);
    vi.mocked(financeApi.createInvoice).mockResolvedValue(draft);
    vi.mocked(financeApi.issueInvoice).mockResolvedValue({ ...draft, status: "ISSUED", invoiceNumber: "OH/26-27/0001" });
    vi.mocked(financeApi.getNextNumber).mockResolvedValue({ number: "OH/26-27/0001" });
    render(<MemoryRouter initialEntries={["/finance/invoices/new?client=mastek"]}><Routes>
      <Route path="/finance/invoices/new" element={<InvoiceWizardPage mode="new" />} />
      <Route path="/finance/invoices/:reference" element={<p>opened</p>} />
    </Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Continue to line items" }));
    fireEvent.change(screen.getByLabelText("Line 1 description"), { target: { value: "Fee" } });
    fireEvent.change(screen.getByLabelText("Line 1 unit price"), { target: { value: "1000" } });
    expect(screen.getByRole("button", { name: "Save and issue" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/Add Candidate before issuing/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Go to details" }));
    fireEvent.change(screen.getByLabelText("Candidate"), { target: { value: "Asha Rao" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue to line items" }));
    fireEvent.click(screen.getByRole("button", { name: "Save and issue" }));
    const dialog = await screen.findByRole("dialog", { name: /Issue this invoice/ });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save and issue" }));
    await waitFor(() => expect(financeApi.issueInvoice).toHaveBeenCalledWith("REF-00001"));
    await screen.findByText("opened");
  });

  it("issues a draft and records a payment against the balance", async () => {
    const issued = { ...draft, invoiceNumber: "OH/26-27/0001", status: "ISSUED" as const };
    vi.mocked(financeApi.getInvoice).mockResolvedValueOnce(draft).mockResolvedValueOnce(issued)
      .mockResolvedValue({ ...issued, status: "PARTIALLY_PAID", amountPaid: 12400, balanceDue: 200000 });
    vi.mocked(financeApi.getInvoicePayments).mockResolvedValue([]);
    vi.mocked(financeApi.getNextNumber).mockResolvedValue({ number: "OH/26-27/0001" });
    vi.mocked(financeApi.issueInvoice).mockResolvedValue(issued);
    vi.mocked(financeApi.recordPayment).mockResolvedValue({ receiptNumber: "RCPT-00001", invoiceReference: "REF-00001", invoiceNumber: "OH/26-27/0001", clientKey: "mastek", clientName: "Mastek Limited", amount: 12400, currency: "INR", paymentDate: "2026-06-01", method: "UPI", reference: null, notes: null, createdAt: "" });
    render(<MemoryRouter initialEntries={["/finance/invoices/REF-00001"]}><Routes>
      <Route path="/finance/invoices/:reference" element={<FinancePage sectionKey="invoice" />} />
    </Routes></MemoryRouter>);
    await screen.findByText(/It will be numbered/);
    fireEvent.click(screen.getByRole("button", { name: "Issue invoice" }));
    const dialog = await screen.findByRole("dialog", { name: /Issue this invoice/ });
    expect(dialog.textContent).toContain("It will be numbered OH/26-27/0001");
    expect(financeApi.issueInvoice).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Issue invoice" }));
    await waitFor(() => expect(financeApi.issueInvoice).toHaveBeenCalledWith("REF-00001"));
    fireEvent.click(await screen.findByRole("button", { name: "Record payment" }));
    expect(screen.getByText(/Horizon does not collect the money/)).toBeTruthy();
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
    expect(screen.getByRole("link", { name: "INV-00001" }).getAttribute("href")).toBe("/finance/invoices/REF-00001");
    expect(screen.getByRole("link", { name: "Design your own invoice template" })).toBeTruthy();
  });

  it("shows the summary error instead of zero receivables when the overview request fails", async () => {
    vi.mocked(financeApi.getBillingSummary).mockRejectedValue(new Error("Billing summary is unavailable"));
    vi.mocked(financeApi.getTemplates).mockResolvedValue([]);
    vi.mocked(financeApi.getInvoices).mockResolvedValue({ content: [], page: 0, size: 5, totalElements: 0, totalPages: 0, sort: "createdAt", direction: "desc" });
    render(<MemoryRouter><FinancePage sectionKey="overview" /></MemoryRouter>);
    expect(await screen.findByText("Billing summary is unavailable")).toBeTruthy();
    expect(screen.queryByText("₹0.00")).toBeNull();
  });

  it("shows allocated and unallocated receipt amounts from the collections response", async () => {
    vi.mocked(financeApi.getClients).mockResolvedValue([client]);
    vi.mocked(financeApi.getInvoices).mockResolvedValue({ content: [], page: 0, size: 100, totalElements: 0, totalPages: 0, sort: "createdAt", direction: "desc" });
    vi.mocked(financeApi.getPayments).mockResolvedValue({ content: [{
      receiptNumber: "RCPT-00001", invoiceReference: null, invoiceNumber: null, clientKey: "mastek", clientName: "Mastek Limited",
      amount: 180000, currency: "INR", paymentDate: "2026-06-15", method: "BANK_TRANSFER", reference: null, notes: null, createdAt: "",
      allocatedAmount: 168000, unallocatedAmount: 12000, allocationId: null,
    }], page: 0, size: 20, totalElements: 1, totalPages: 1, sort: "paymentDate", direction: "desc" });
    render(<MemoryRouter><FinancePage sectionKey="payments" /></MemoryRouter>);
    expect(await screen.findByText("RCPT-00001")).toBeTruthy();
    expect(screen.getByText("Several invoices")).toBeTruthy();
    expect(screen.getByText("₹1,68,000.00")).toBeTruthy();
    expect(screen.getByText("₹12,000.00")).toBeTruthy();
    expect(screen.getByText(/Only the amount allocated to an invoice reduces what that client owes/)).toBeTruthy();
  });

  it("prints the statement basis and keeps an unallocated receipt out of the closing receivable", async () => {
    vi.mocked(financeApi.getClient).mockResolvedValue(client);
    vi.mocked(financeApi.getInvoices).mockResolvedValue({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, sort: "createdAt", direction: "desc" });
    vi.mocked(financeApi.getFiscalYears).mockResolvedValue([{ label: "2026-27", start: "2026-04-01", end: "2027-03-31", current: true }]);
    vi.mocked(financeApi.getStatement).mockResolvedValue({
      fiscalYear: "2026-27", start: "2026-04-01", end: "2027-03-31", clientKey: "mastek", clientName: "Mastek Limited",
      basis: "Invoiced amounts use the invoice date. Collections use the receipt date.",
      currencies: [{ currency: "INR", openingBalance: 0, lines: [], totalDebit: 212400, totalCredit: 0, closingBalance: 212400 }],
      unallocated: [{ receiptNumber: "RCPT-00009", date: "2026-06-15", amount: 12000, unallocated: 12000, currency: "INR" }],
    });
    const download = vi.spyOn(financeApi, "downloadCsv").mockImplementation(() => undefined);
    render(<MemoryRouter initialEntries={["/finance/clients/mastek"]}><Routes>
      <Route path="/finance/clients/:clientKey" element={<ClientPages section="profile" />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByText(/Invoiced amounts use the invoice date/)).toBeTruthy();
    expect(screen.getByText(/not included in the closing receivable/)).toBeTruthy();
    expect(screen.getByText("RCPT-00009")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(download).toHaveBeenCalledWith("statement-mastek-2026-27.csv", expect.any(Array));
    const rows = download.mock.calls[0][1] as (string | number | null)[][];
    expect(rows[0]).toEqual(["Basis", "Invoiced amounts use the invoice date. Collections use the receipt date."]);
    expect(rows.some((row) => row[0] === "RCPT-00009" || row[1] === "RCPT-00009")).toBe(true);
  });

});

describe("Invoice templates", () => {
  it("starts from an industry preset, previews edits live and saves the template", async () => {
    vi.mocked(financeApi.createTemplate).mockResolvedValue({ ...template, templateKey: "recruitment-staffing-invoice" });
    render(<MemoryRouter initialEntries={["/finance/templates/new"]}><CurrentLocation /><Routes>
      <Route path="/finance/templates/new" element={<TemplatesPage section="new" />} />
      <Route path="/finance/templates/:templateKey" element={<p>saved</p>} />
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
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("/finance/templates/recruitment-staffing-invoice"));
  });
});

describe("Clients", () => {
  it("adds a client: name suggests the code, GSTIN fills in the state, and the review offers the first invoice", async () => {
    vi.mocked(financeApi.getClients).mockResolvedValue([client]);
    const created = { ...client, clientKey: "infosys-limited", displayName: "Infosys Limited", region: "Karnataka", taxId: "29AAACI4798L1ZQ", paymentTermsDays: 45 };
    vi.mocked(financeApi.createClient).mockResolvedValue(created);
    vi.mocked(financeApi.getClient).mockResolvedValue(created);
    render(<MemoryRouter initialEntries={["/finance/clients/new"]}><Routes>
      <Route path="/finance/clients/new" element={<ClientPages section="new" />} />
    </Routes></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText("Client name"), { target: { value: "Infosys Limited" } });
    expect((screen.getByLabelText("Client code") as HTMLInputElement).value).toBe("infosys-limited");
    fireEvent.change(screen.getByLabelText(/GSTIN/), { target: { value: "29aaaci4798l1zq" } });
    expect(screen.getByText("Filled in from the GSTIN: registered in Karnataka.")).toBeTruthy();
    chooseOption("Payment terms", /Net 45/);
    await waitFor(() => expect(screen.getByRole("button", { name: "Save client" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Save client" }));
    await waitFor(() => expect(financeApi.createClient).toHaveBeenCalledWith(expect.objectContaining({
      clientKey: "infosys-limited", displayName: "Infosys Limited", taxId: "29AAACI4798L1ZQ", region: "Karnataka", country: "IN", paymentTermsDays: 45, currency: "INR",
    })));
    expect(await screen.findByRole("heading", { name: "Infosys Limited is ready to bill" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create an invoice for Infosys Limited" }).getAttribute("href")).toBe("/finance/invoices/new?client=infosys-limited");
  });

  it("flags an invalid GSTIN and a code that is already taken", async () => {
    vi.mocked(financeApi.getClients).mockResolvedValue([client]);
    render(<MemoryRouter initialEntries={["/finance/clients/new"]}><Routes>
      <Route path="/finance/clients/new" element={<ClientPages section="new" />} />
    </Routes></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText("Client name"), { target: { value: "Mastek" } });
    await waitFor(() => expect((screen.getByLabelText("Client code") as HTMLInputElement).value).toBe("mastek-2"));
    fireEvent.change(screen.getByLabelText("Client code"), { target: { value: "mastek" } });
    expect(screen.getByText("mastek is already used by another client.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/GSTIN/), { target: { value: "27AAACM99" } });
    expect(screen.getByText("A GSTIN has 15 characters; this has 9.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save client" }));
    expect(financeApi.createClient).not.toHaveBeenCalled();
  });

  it("lists clients with search and opens a profile with their invoices and an archive confirmation", async () => {
    vi.mocked(financeApi.getClients).mockResolvedValue([client, { ...client, clientKey: "acme", displayName: "Acme Inc", country: "US", region: null, taxId: null, currency: "USD" }]);
    const view = render(<MemoryRouter initialEntries={["/finance/clients"]}><Routes>
      <Route path="/finance/clients" element={<ClientPages section="list" />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByRole("link", { name: "Acme Inc" })).toBeTruthy();
    expect(screen.getByText("Showing 1–2 of 2")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search clients"), { target: { value: "27AAACM" } });
    await waitFor(() => expect(screen.queryByRole("link", { name: "Acme Inc" })).toBeNull());
    expect(screen.getByRole("link", { name: "Mastek Limited" }).getAttribute("href")).toBe("/finance/clients/mastek");
    view.unmount();

    vi.mocked(financeApi.getClient).mockResolvedValue({ ...client, outstandingAmount: 8400, openInvoices: 1 });
    vi.mocked(financeApi.getInvoices).mockResolvedValue({ content: [{ ...draft, invoiceNumber: "INV-00001", status: "ISSUED", overdue: true }], page: 0, size: 10, totalElements: 1, totalPages: 1, sort: "createdAt", direction: "desc" });
    vi.mocked(financeApi.updateClient).mockResolvedValue({ ...client, status: "ARCHIVED" });
    render(<MemoryRouter initialEntries={["/finance/clients/mastek"]}><Routes>
      <Route path="/finance/clients/:clientKey" element={<ClientPages section="profile" />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByRole("link", { name: "INV-00001" })).toBeTruthy();
    expect(screen.getByText("₹8,400.00")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    const dialog = await screen.findByRole("dialog", { name: "Archive Mastek Limited?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Archive client" }));
    await waitFor(() => expect(financeApi.updateClient).toHaveBeenCalledWith("mastek", { status: "ARCHIVED" }));
  });
});

describe("Books, items and templates", () => {
  it("shows the financial year month by month with the opening balance carried forward", async () => {
    vi.mocked(financeApi.getFiscalYears).mockResolvedValue([{ label: "2027-28", start: "2027-04-01", end: "2028-03-31", current: true }, { label: "2026-27", start: "2026-04-01", end: "2027-03-31", current: false }]);
    const month = (m: string, values: Partial<financeApi.MonthRow> = {}): financeApi.MonthRow => ({ month: m, start: `${m}-01`, end: `${m}-28`, invoicesIssued: 0, invoicesVoided: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, otherTax: 0, invoiced: 0, collected: 0, closingReceivables: 124200, ...values });
    const months = ["2027-04", "2027-05", "2027-06", "2027-07", "2027-08", "2027-09", "2027-10", "2027-11", "2027-12", "2028-01", "2028-02", "2028-03"].map((m) => month(m));
    months[0] = month("2027-04", { invoicesIssued: 1, taxable: 5000, cgst: 450, sgst: 450, invoiced: 5900, closingReceivables: 130100 });
    vi.mocked(financeApi.getYearSummary).mockResolvedValue({ fiscalYear: "2027-28", start: "2027-04-01", end: "2028-03-31", booksLockedUntil: "2027-03-31",
      currencies: [{ currency: "INR", openingReceivables: 124200, months, total: month("total", { invoicesIssued: 1, taxable: 5000, cgst: 450, sgst: 450, invoiced: 5900 }), closingReceivables: 130100 }] });
    render(<MemoryRouter initialEntries={["/finance/books"]}><Routes><Route path="/finance/books" element={<BooksPage section="summary" />} /></Routes></MemoryRouter>);
    expect(await screen.findByText("FY 2027-28 month by month")).toBeTruthy();
    expect(financeApi.getYearSummary).toHaveBeenCalledWith("2027-28");
    expect(screen.getByText(/Books are locked up to/)).toBeTruthy();
    expect(screen.getAllByText("₹1,24,200.00").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Apr 2027" }).getAttribute("href")).toBe("/finance/books/sales-register?fy=2027-28&month=2027-04");
    expect(screen.getByText("Total FY 2027-28")).toBeTruthy();
  });

  it("suggests the next code for a service line when adding an item", async () => {
    vi.mocked(financeApi.getNextItemCode).mockResolvedValue({ code: "REC-004" });
    vi.mocked(financeApi.createItem).mockResolvedValue({ itemCode: "REC-004", name: "Recruitment fee", description: null, kind: "SERVICE", category: "Recruitment", hsnSac: "998512", unit: "Placement", unitPrice: 180000, taxRate: 18, status: "ACTIVE", createdAt: "", updatedAt: "" });
    render(<MemoryRouter initialEntries={["/finance/items/new"]}><CurrentLocation /><Routes>
      <Route path="/finance/items/new" element={<ItemPages section="new" />} />
      <Route path="/finance/items/:itemCode" element={<p>saved</p>} />
    </Routes></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Recruitment fee" } });
    fireEvent.change(screen.getByLabelText(/Service line/), { target: { value: "Recruitment" } });
    await waitFor(() => expect((screen.getByLabelText("Item code") as HTMLInputElement).value).toBe("REC-004"));
    expect(financeApi.getNextItemCode).toHaveBeenLastCalledWith("REC");
    fireEvent.change(screen.getByLabelText(/SAC code/), { target: { value: "99851" } });
    expect(screen.getByText("Use 4, 6 or 8 digits.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/SAC code/), { target: { value: "998512" } });
    fireEvent.click(screen.getByRole("button", { name: "Save item" }));
    await waitFor(() => expect(financeApi.createItem).toHaveBeenCalledWith(expect.objectContaining({ itemCode: "REC-004", name: "Recruitment fee", category: "Recruitment", hsnSac: "998512", kind: "SERVICE" })));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("/finance/items/REC-004"));
  });

  it("fills an invoice line from the items registry", async () => {
    vi.mocked(financeApi.getClients).mockResolvedValue([client]);
    vi.mocked(financeApi.getTemplates).mockResolvedValue([{ ...template, config: { ...recruitment, columns: { ...recruitment.columns, showHsnSac: true } } }]);
    vi.mocked(financeApi.getItems).mockResolvedValue([{ itemCode: "REC-001", name: "Recruitment fee", description: "Recruitment fee — permanent placement", kind: "SERVICE", category: "Recruitment", hsnSac: "998512", unit: "Placement", unitPrice: 180000, taxRate: 18, status: "ACTIVE", createdAt: "", updatedAt: "" }]);
    vi.mocked(financeApi.getNextNumber).mockResolvedValue({ number: "OH/26-27/0001" });
    render(<MemoryRouter initialEntries={["/finance/invoices/new?client=mastek"]}><Routes><Route path="/finance/invoices/new" element={<InvoiceWizardPage mode="new" />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Continue to line items" }));
    chooseOption("Line 1 item or service", /REC-001 · Recruitment fee/);
    expect((screen.getByLabelText("Line 1 description") as HTMLInputElement).value).toBe("Recruitment fee — permanent placement");
    expect((screen.getByLabelText("Line 1 HSN/SAC") as HTMLInputElement).value).toBe("998512");
    expect((screen.getByLabelText("Line 1 unit") as HTMLInputElement).value).toBe("Placement");
    expect((screen.getByLabelText("Line 1 unit price") as HTMLInputElement).value).toBe("180000");
    const bill = screen.getByRole("article", { name: "Invoice draft" });
    expect(bill.textContent).toContain("998512");
    expect(bill.textContent).toContain("₹2,12,400.00");
  });

  it("switches the industry details section off for a plain bill and back on with its fields", async () => {
    render(<MemoryRouter initialEntries={["/finance/templates/new?preset=recruitment"]}><Routes><Route path="/finance/templates/new" element={<TemplatesPage section="new" />} /></Routes></MemoryRouter>);
    const preview = screen.getByRole("region", { name: "Preview" });
    expect(within(preview).queryByLabelText("Recruitment engagement")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Show an industry details section on this bill"));
    expect(within(preview).queryByLabelText("Recruitment engagement")).toBeNull();
    expect(screen.getByText(/a plain invoice that suits any business/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Show an industry details section on this bill"));
    expect(screen.getAllByLabelText("Field label").map((input) => (input as HTMLInputElement).value)).toEqual(["Candidate", "Position", "Joining date"]);
  });
});
