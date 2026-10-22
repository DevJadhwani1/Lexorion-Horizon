import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chooseOption } from "../../test/dropdown";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkforcePage } from "./WorkforcePage";
import * as workforceApi from "../../features/workforce/workforceApi";
import * as payrollApi from "../../features/payroll/payrollApi";
import { ApiError } from "../../api/types";

const employee = vi.hoisted(() => ({
  employeeCode: "EMP-001", firstName: "Ada", middleName: null, lastName: "Lovelace",
  workEmail: "ada@example.test", phone: null, joiningDate: "2026-01-01", status: "ACTIVE" as const,
  departmentKey: "engineering", designationKey: "developer", reportingManagerEmployeeCode: null,
}));
vi.mock("../../auth/AuthProvider", () => ({ useAuth: () => ({ organization: { membershipRole: "ADMIN" } }) }));
vi.mock("../../workspace/WorkspaceProvider", () => ({ useWorkspace: () => ({ workspace: { key: "main", products: [{ key: "workforce" }, { key: "payroll" }] } }) }));
vi.mock("../../features/workforce/workforceApi", async (load) => {
  const actual = await load<typeof import("../../features/workforce/workforceApi")>();
  return { ...actual, getEmployee: vi.fn(async () => employee), getEmployeeHistory: vi.fn(async () => []), updateEmployee: vi.fn(async () => employee),
    getEmployees: vi.fn(async () => ({ content: [employee], page: 0, size: 20, totalElements: 1, totalPages: 1, sort: "firstName", direction: "ASC" })),
    getDepartments: vi.fn(async () => [{ key: "engineering", name: "Engineering", status: "ACTIVE", parentDepartmentKey: null }]),
    getDesignations: vi.fn(async () => [{ key: "developer", name: "Developer", status: "ACTIVE", parentDepartmentKey: null }]) };
});
vi.mock("../../features/payroll/payrollApi", () => ({ getPayrollEmployee: vi.fn(), getProfiles: vi.fn() }));

beforeEach(() => {
  vi.mocked(workforceApi.getEmployee).mockResolvedValue(employee);
  vi.mocked(payrollApi.getPayrollEmployee).mockResolvedValue({ employeeCode: "EMP-001", currency: "INR", payFrequency: "MONTHLY", effectiveFrom: "2026-01-01", status: "ACTIVE" });
  vi.mocked(payrollApi.getProfiles).mockResolvedValue([{ employeeCode: "EMP-001", profileKey: "SAL-1", sourceTemplateKey: null, sourceTemplateVersion: null, currency: "INR", effectiveFrom: "2026-01-01", effectiveTo: null, status: "ACTIVE", components: [{ componentKey: "BASIC", displayName: "Basic", category: "EARNING", amountType: "FIXED_AMOUNT", frequency: "MONTHLY", occurrenceType: "RECURRING", taxability: "TAXABLE", value: 1000 }] }]);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const profile = () => render(<MemoryRouter initialEntries={["/workforce/employees/EMP-001"]}><Routes><Route path="/workforce/employees/:employeeCode" element={<WorkforcePage />} /></Routes></MemoryRouter>);

describe("employee profile", () => {
  it("shows names instead of keys and sends explicit nulls when optional pickers are cleared", async () => {
    profile();
    await screen.findByRole("heading", { name: "Ada Lovelace" });
    expect(await screen.findByText("Engineering")).toBeTruthy();
    expect((await screen.findByRole("link", { name: "View compensation" })).getAttribute("href")).toContain("employee=EMP-001");
    fireEvent.click(screen.getByRole("button", { name: "Edit details" }));
    expect(screen.getByRole("combobox", { name: "Department" }).textContent).toContain("Engineering");
    chooseOption("Department", "No department");
    chooseOption("Designation", "No designation");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(workforceApi.updateEmployee).toHaveBeenCalledWith("EMP-001", expect.objectContaining({ departmentKey: null, designationKey: null, reportingManagerEmployeeCode: null })));
  });

  it("offers guided payroll setup when the employee is not enrolled", async () => {
    vi.mocked(payrollApi.getPayrollEmployee).mockRejectedValue(new ApiError(404, "Payroll employee not found"));
    profile();
    expect((await screen.findByRole("link", { name: "Set up payroll" })).getAttribute("href")).toBe("/app/workforce/employees/new?employee=EMP-001");
  });
});

describe("employee directory", () => {
  it("uses server-side search, filters, sorting and paging", async () => {
    render(<MemoryRouter initialEntries={["/workforce/employees"]}><Routes><Route path="/workforce/employees" element={<WorkforcePage sectionKey="employees" />} /></Routes></MemoryRouter>);
    await screen.findByRole("link", { name: "Ada Lovelace" });
    const lastQuery = () => new URLSearchParams(vi.mocked(workforceApi.getEmployees).mock.calls.at(-1)?.[0]);
    expect(lastQuery().get("size")).toBe("20");
    fireEvent.change(screen.getByLabelText("Search employees"), { target: { value: "ada" } });
    await waitFor(() => expect(lastQuery().get("search")).toBe("ada"), { timeout: 2000 });
    chooseOption("Status", "On leave");
    await waitFor(() => expect(lastQuery().get("status")).toBe("ON_LEAVE"));
    await screen.findByRole("combobox", { name: "Department" });
    chooseOption("Department", "Engineering");
    await waitFor(() => expect(lastQuery().get("departmentKey")).toBe("engineering"));
    chooseOption("Sort by", "Joining date (newest first)");
    await waitFor(() => { expect(lastQuery().get("sort")).toBe("joiningDate"); expect(lastQuery().get("direction")).toBe("DESC"); });
    expect(lastQuery().get("search")).toBe("ada");
    expect(lastQuery().get("page")).toBe("0");
    expect(screen.getByText("Engineering", { selector: "td" })).toBeTruthy();
  });
});
