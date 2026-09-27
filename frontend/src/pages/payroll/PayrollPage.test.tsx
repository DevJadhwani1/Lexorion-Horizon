import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { PayrollPage } from "./PayrollPage";
import * as payrollApi from "../../features/payroll/payrollApi";

vi.mock("../../workspace/WorkspaceProvider", () => ({ useWorkspace: () => ({ workspace: { key: "shared", products: [{ key: "payroll" }] } }) }));
vi.mock("../../features/payroll/payrollApi", async (load) => {
  const actual = await load<typeof import("../../features/payroll/payrollApi")>();
  return { ...actual, getPayrollEmployees: vi.fn(async () => []), getProfiles: vi.fn(async () => []), getPayrollEmployee: vi.fn(async (employeeCode: string) => ({ employeeCode, currency: "USD", payFrequency: "MONTHLY", effectiveFrom: "2026-01-01", status: "ACTIVE" })), createPayrollEmployee: vi.fn(async () => ({})) };
});

beforeEach(() => { vi.mocked(payrollApi.getProfiles).mockResolvedValue([]); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function CurrentLocation() { const location = useLocation(); return <output>{location.pathname}{location.search}</output>; }

describe("Payroll employee handoff", () => {
  it("loads the employee supplied in the compensation query string", async () => {
    render(<MemoryRouter initialEntries={["/payroll/compensation?employee=EMP-001"]}><Routes><Route path="/payroll/compensation" element={<PayrollPage sectionKey="compensation" />} /></Routes></MemoryRouter>);
    await screen.findByText("EMP-001");
    expect(payrollApi.getProfiles).toHaveBeenCalledWith("EMP-001");
    expect(payrollApi.getPayrollEmployee).toHaveBeenCalledWith("EMP-001");
  });

  it("opens compensation after configuring the selected workforce employee", async () => {
    render(<MemoryRouter initialEntries={["/payroll/employees?employee=EMP-001"]}><CurrentLocation /><Routes><Route path="/payroll/employees" element={<PayrollPage sectionKey="employees" />} /><Route path="/payroll/compensation" element={<PayrollPage sectionKey="compensation" />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByText("Configure employee"));
    fireEvent.change(screen.getByLabelText("Employee code"), { target: { value: "EMP-001" } });
    fireEvent.change(screen.getByLabelText("Effective from"), { target: { value: "2026-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("/payroll/compensation?employee=EMP-001"));
    expect(payrollApi.createPayrollEmployee).toHaveBeenCalledWith(expect.objectContaining({ employeeCode: "EMP-001", status: "ACTIVE" }));
  });
});
