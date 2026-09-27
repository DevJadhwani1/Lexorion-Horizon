import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PayrollPage } from "./PayrollPage";
import * as payrollApi from "../../features/payroll/payrollApi";

vi.mock("../../workspace/WorkspaceProvider", () => ({ useWorkspace: () => ({ workspace: { key: "shared", products: [{ key: "payroll" }] } }) }));
vi.mock("../../features/payroll/payrollApi", async (load) => {
  const actual = await load<typeof import("../../features/payroll/payrollApi")>();
  return { ...actual, getProfiles: vi.fn(async () => []), getPayrollEmployee: vi.fn(async (employeeCode: string) => ({ employeeCode, currency: "USD", payFrequency: "MONTHLY", effectiveFrom: "2026-01-01", status: "ACTIVE" })) };
});

beforeEach(() => { vi.mocked(payrollApi.getProfiles).mockResolvedValue([]); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Payroll employee handoff", () => {
  it("loads the employee supplied in the compensation query string", async () => {
    render(<MemoryRouter initialEntries={["/payroll/compensation?employee=EMP-001"]}><Routes><Route path="/payroll/compensation" element={<PayrollPage sectionKey="compensation" />} /></Routes></MemoryRouter>);
    await screen.findByText("EMP-001");
    expect(payrollApi.getProfiles).toHaveBeenCalledWith("EMP-001");
    expect(payrollApi.getPayrollEmployee).toHaveBeenCalledWith("EMP-001");
  });
});
