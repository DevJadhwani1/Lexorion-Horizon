import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chooseOption } from "../../test/dropdown";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { PayrollPage } from "./PayrollPage";
import * as payrollApi from "../../features/payroll/payrollApi";

vi.mock("../../auth/AuthProvider", () => ({ useAuth: () => ({ organization: { organizationId: "org", membershipRole: "ADMIN" } }) }));
vi.mock("../../features/admin/adminApi", async (load) => ({ ...(await load<typeof import("../../features/admin/adminApi")>()), getOrganization: vi.fn(async () => ({ settings: { currency: "INR", locale: "en-IN" } })) }));
vi.mock("../../workspace/WorkspaceProvider", () => ({ useWorkspace: () => ({ workspace: { key: "shared", products: [{ key: "payroll" }] } }) }));
vi.mock("../../features/payroll/payrollApi", async (load) => {
  const actual = await load<typeof import("../../features/payroll/payrollApi")>();
  return { ...actual, getPayRunPreparation: vi.fn(), savePayRunPreparation: vi.fn(), getPayRuns: vi.fn(), getPayRunEmployees: vi.fn(async () => []), processPayRun: vi.fn(), recoverPayRun: vi.fn(), getPayRun: vi.fn(), finalizePayRun: vi.fn(), getPayrollEmployees: vi.fn(async () => []), getProfiles: vi.fn(async () => []), getPayrollEmployee: vi.fn(async (employeeCode: string) => ({ employeeCode, currency: "USD", payFrequency: "MONTHLY", effectiveFrom: "2026-01-01", status: "ACTIVE" })), createPayrollEmployee: vi.fn(async () => ({})) };
});

const prepared = { payRunKey: "RUN-1", status: "DRAFT", periodStart: "2026-10-01", periodEnd: "2026-10-31", calculationDate: "2026-10-31", currency: "USD", employeeCount: 1, eligibleCount: 1, blockedCount: 0, selectedCount: 1, selectedBlockedCount: 0, ready: true, issues: [], employees: [{ employeeCode: "EMP-001", selected: true, eligible: true, blockedReason: null }] };
beforeEach(() => { vi.mocked(payrollApi.getPayRunPreparation).mockResolvedValue(prepared); vi.mocked(payrollApi.getProfiles).mockResolvedValue([]); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function CurrentLocation() { const location = useLocation(); return <output>{location.pathname}{location.search}</output>; }

describe("Payroll employee handoff", () => {
  it("loads the employee supplied in the compensation query string", async () => {
    const view = render(<MemoryRouter initialEntries={["/payroll/compensation?employee=EMP-001"]}><Routes><Route path="/payroll/compensation" element={<PayrollPage sectionKey="compensation" />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(view.container.querySelector(".employee-context")?.textContent).toContain("EMP-001"));
    expect(payrollApi.getProfiles).toHaveBeenCalledWith("EMP-001");
    expect(payrollApi.getPayrollEmployee).toHaveBeenCalledWith("EMP-001");
  });

  it("opens compensation after configuring the selected workforce employee, defaulting to the organization currency", async () => {
    render(<MemoryRouter initialEntries={["/payroll/employees?employee=EMP-001"]}><CurrentLocation /><Routes><Route path="/payroll/employees" element={<PayrollPage sectionKey="employees" />} /><Route path="/payroll/compensation" element={<PayrollPage sectionKey="compensation" />} /></Routes></MemoryRouter>);
    expect((await screen.findByLabelText("Employee code") as HTMLInputElement).value).toBe("EMP-001");
    await waitFor(() => expect((document.querySelector('input[name="currency"]') as HTMLInputElement).value).toBe("INR"));
    fireEvent.change(screen.getByLabelText("Payroll start date"), { target: { value: "2026-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Save payroll settings" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("/payroll/compensation?employee=EMP-001"));
    expect(payrollApi.createPayrollEmployee).toHaveBeenCalledWith(expect.objectContaining({ employeeCode: "EMP-001", status: "ACTIVE", currency: "INR", payFrequency: "MONTHLY" }));
  });
});


it("retains the selected pay run through processing and finalization reloads", async () => {
  const run = { payRunKey: "RUN-1", periodStart: "2026-10-01", periodEnd: "2026-10-31", calculationDate: "2026-10-31", currency: "USD", status: "DRAFT", grossTotal: 1000, deductionTotal: 0, netTotal: 1000, employeeCount: 1, createdAt: "2026-10-01", finalizedAt: null };
  vi.mocked(payrollApi.getPayRuns).mockResolvedValue({ content: [run], page: 0, totalPages: 1, size: 20, totalElements: 1, sort: "createdAt", direction: "desc" });
  vi.mocked(payrollApi.getPayRunEmployees).mockResolvedValue([{ employeeCode: "EMP-001", grossAmount: 1000, deductionAmount: 0, netAmount: 1000, currency: "USD", calculationDate: "2026-10-31" }]);
  vi.mocked(payrollApi.processPayRun).mockResolvedValue({ ...run, status: "CALCULATED" });
  vi.mocked(payrollApi.finalizePayRun).mockResolvedValue({ ...run, status: "FINALIZED" });
  render(<MemoryRouter><PayrollPage sectionKey="pay-runs" /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Open" }));
  await screen.findByText("EMP-001");
  fireEvent.click(screen.getByRole("button", { name: "Process" }));
  fireEvent.click(await screen.findByRole("button", { name: "Calculate pay" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Finalize" }).hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Finalize" }));
  expect((await screen.findByRole("dialog", { name: "Finalize RUN-1?" })).textContent).toContain("This cannot be undone.");
  fireEvent.click(screen.getByRole("button", { name: "Finalize pay run" }));
  await screen.findByText(/Finalized payroll is immutable/);
  expect(payrollApi.finalizePayRun).toHaveBeenCalledWith("RUN-1");
  vi.restoreAllMocks();
});

it("shows the failed-run reason and recovers to draft before retry", async () => {
  const run = { payRunKey: "FAILED-1", periodStart: "2026-10-01", periodEnd: "2026-10-31", calculationDate: "2026-10-31", currency: "USD", status: "FAILED", grossTotal: 0, deductionTotal: 0, netTotal: 0, employeeCount: 1, createdAt: "2026-10-01", finalizedAt: null, failureMessage: "No effective compensation profile" };
  vi.mocked(payrollApi.getPayRuns).mockResolvedValue({ content: [run], page: 0, totalPages: 1, size: 20, totalElements: 1, sort: "createdAt", direction: "desc" });
  vi.mocked(payrollApi.getPayRunEmployees).mockResolvedValue([{ employeeCode: "EMP-001", grossAmount: 0, deductionAmount: 0, netAmount: 0, currency: "USD", calculationDate: "2026-10-31" }]);
  vi.mocked(payrollApi.recoverPayRun).mockResolvedValue({ ...run, status: "DRAFT", failureMessage: null });
  render(<MemoryRouter><PayrollPage sectionKey="pay-runs" /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Open" }));
  await screen.findByText("No effective compensation profile");
  fireEvent.click(screen.getByRole("button", { name: "Recover to draft" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Process" }).hasAttribute("disabled")).toBe(false));
  expect(payrollApi.recoverPayRun).toHaveBeenCalledWith("FAILED-1");
});

it("clears the loaded employee before a different employee can be used for calculation", async () => {
  const getCalculations = vi.spyOn(payrollApi, "getCalculations").mockResolvedValue([]);
  const enrolled = (employeeCode: string) => ({ employeeCode, currency: "USD", payFrequency: "MONTHLY" as const, effectiveFrom: "2026-01-01", status: "ACTIVE" as const });
  vi.mocked(payrollApi.getPayrollEmployees).mockResolvedValue([enrolled("EMP-001"), enrolled("EMP-OTHER")]);
  const view = render(<MemoryRouter initialEntries={["/payroll/calculations?employee=EMP-001"]}><PayrollPage sectionKey="calculations" /></MemoryRouter>);
  const banner = () => view.container.querySelector(".employee-context")?.textContent ?? null;
  await waitFor(() => expect(banner()).toContain("EMP-001"));
  expect(screen.getByRole("button", { name: "Calculate" }).hasAttribute("disabled")).toBe(false);
  chooseOption("Employee", /EMP-OTHER/);
  expect(banner()).toBeNull();
  expect(screen.getByRole("button", { name: "Calculate" }).hasAttribute("disabled")).toBe(true);
  await waitFor(() => expect(banner()).toContain("EMP-OTHER"));
  expect(getCalculations).toHaveBeenLastCalledWith("EMP-OTHER");
});

it("links pay-run compensation setup back to the selected run", async () => {
  const run = { payRunKey: "RETURN-1", periodStart: "2026-10-01", periodEnd: "2026-10-31", calculationDate: "2026-10-31", currency: "USD", status: "DRAFT", grossTotal: 0, deductionTotal: 0, netTotal: 0, employeeCount: 1, createdAt: "2026-10-01", finalizedAt: null };
  vi.mocked(payrollApi.getPayRuns).mockResolvedValue({ content: [run], page: 0, totalPages: 1 } as never);
  vi.mocked(payrollApi.getPayRunEmployees).mockResolvedValue([{ employeeCode: "EMP-001", currency: "USD", grossAmount: 0, deductionAmount: 0, netAmount: 0, calculationDate: "2026-10-31" }]);
  render(<MemoryRouter><PayrollPage sectionKey="pay-runs" /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Open" }));
  const link = await screen.findByRole("link", { name: "Review compensation" });
  const params = new URL(link.getAttribute("href")!, "http://localhost").searchParams;
  expect(params.get("employee")).toBe("EMP-001");
  expect(params.get("returnTo")).toBe("/app/payroll/pay-runs?run=RETURN-1");
});

it("creates a monthly pay run from the next month with derived dates and the employees' currency", async () => {
  const finalized = { payRunKey: "PAY-2026-09", periodStart: "2026-09-01", periodEnd: "2026-09-30", calculationDate: "2026-09-30", currency: "INR", status: "FINALIZED", grossTotal: 1000, deductionTotal: 0, netTotal: 1000, employeeCount: 1, createdAt: "2026-09-30", finalizedAt: "2026-09-30" };
  vi.mocked(payrollApi.getPayRuns).mockResolvedValue({ content: [finalized], page: 0, totalPages: 1, size: 20, totalElements: 1, sort: "createdAt", direction: "desc" });
  vi.mocked(payrollApi.getPayrollEmployees).mockResolvedValue([{ employeeCode: "EMP-001", currency: "INR", payFrequency: "MONTHLY", effectiveFrom: "2026-01-01", status: "ACTIVE" }]);
  const created = { ...finalized, payRunKey: "PAY-2026-10", periodStart: "2026-10-01", periodEnd: "2026-10-31", calculationDate: "2026-10-31", status: "DRAFT", employeeCount: 0 };
  const createPayRun = vi.spyOn(payrollApi, "createPayRun").mockResolvedValue(created);
  render(<MemoryRouter><PayrollPage sectionKey="pay-runs" /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "New pay run" }));
  expect((screen.getByLabelText("Pay month") as HTMLInputElement).value).toBe("2026-10");
  const create = await screen.findByRole("button", { name: "Create October 2026 draft" });
  await waitFor(() => expect(screen.getByText(/1 monthly employee/)).toBeTruthy());
  fireEvent.click(create);
  await waitFor(() => expect(createPayRun).toHaveBeenCalledWith({ payRunKey: "PAY-2026-10", periodStart: "2026-10-01", periodEnd: "2026-10-31", calculationDate: "2026-10-31", currency: "INR" }));
  expect(await screen.findByRole("article", { name: "Pay run PAY-2026-10" })).toBeTruthy();
  vi.restoreAllMocks();
});
