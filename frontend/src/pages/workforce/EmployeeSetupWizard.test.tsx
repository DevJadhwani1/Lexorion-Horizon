import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { EmployeeSetupWizard } from "./EmployeeSetupWizard";
import * as workforceApi from "../../features/workforce/workforceApi";
import * as payrollApi from "../../features/payroll/payrollApi";
import * as adminApi from "../../features/admin/adminApi";
import { ApiError } from "../../api/types";

const ada = { employeeCode: "EMP-002", firstName: "Ada", middleName: null, lastName: "Lovelace", workEmail: "ada@example.test", phone: null, joiningDate: "2026-10-01", status: "ACTIVE" as const, departmentKey: null, designationKey: null, reportingManagerEmployeeCode: null };
const existing = { ...ada, employeeCode: "EMP-001", firstName: "Grace", lastName: "Hopper" };
const enrolled = { employeeCode: "EMP-002", currency: "INR", payFrequency: "MONTHLY" as const, effectiveFrom: "2026-10-01", status: "ACTIVE" as const };
vi.mock("../../auth/AuthProvider", () => ({ useAuth: () => ({ organization: { organizationId: "org", membershipRole: "ADMIN" } }) }));
vi.mock("../../workspace/WorkspaceProvider", () => ({ useWorkspace: () => ({ workspace: { key: "main", products: [{ key: "workforce" }, { key: "payroll" }] } }) }));
vi.mock("../../features/admin/adminApi", () => ({ getOrganization: vi.fn() }));
vi.mock("../../features/workforce/workforceApi", () => ({
  getEmployees: vi.fn(), getDepartments: vi.fn(), getDesignations: vi.fn(), getEmployee: vi.fn(), createEmployee: vi.fn(),
}));
vi.mock("../../features/payroll/payrollApi", () => ({
  getPayrollEmployee: vi.fn(), getProfiles: vi.fn(), createPayrollEmployee: vi.fn(), getComponents: vi.fn(), createProfile: vi.fn(), createComponent: vi.fn(),
}));

function Location() { const location = useLocation(); return <output>{location.search}</output>; }
const wizard = (search = "") => render(<MemoryRouter initialEntries={[`/workforce/employees/new${search}`]}><Location /><Routes><Route path="/workforce/employees/new" element={<EmployeeSetupWizard />} /></Routes></MemoryRouter>);
beforeEach(() => {
  vi.mocked(adminApi.getOrganization).mockResolvedValue({ settings: { currency: "INR", locale: "en-IN" } } as adminApi.Organization);
  vi.mocked(workforceApi.getDepartments).mockResolvedValue([]);
  vi.mocked(workforceApi.getDesignations).mockResolvedValue([]);
  vi.mocked(payrollApi.getProfiles).mockResolvedValue([]);
  vi.mocked(workforceApi.getEmployees).mockResolvedValue({ content: [existing], page: 0, size: 100, totalElements: 1, totalPages: 1, sort: "firstName", direction: "ASC" });
  vi.mocked(workforceApi.getEmployee).mockResolvedValue(ada);
  vi.mocked(payrollApi.getComponents).mockResolvedValue([{ componentKey: "BASIC", displayName: "Basic salary", category: "EARNING", amountType: "FIXED_AMOUNT", occurrenceType: "RECURRING", taxability: "TAXABLE", status: "ACTIVE" }]);
});
// Reset (not just clear) so unconsumed one-off responses cannot leak into the next test.
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("creates the employee once, then enrolls and sets salary on the same record", async () => {
  vi.mocked(workforceApi.createEmployee).mockResolvedValue(ada);
  vi.mocked(payrollApi.getPayrollEmployee).mockRejectedValueOnce(new ApiError(404, "Payroll employee not found")).mockResolvedValue(enrolled);
  vi.mocked(payrollApi.createPayrollEmployee).mockResolvedValue(enrolled);
  vi.mocked(payrollApi.getProfiles).mockResolvedValueOnce([])
    .mockResolvedValue([{ employeeCode: "EMP-002", profileKey: "SAL-20261001", sourceTemplateKey: null, sourceTemplateVersion: null, currency: "INR", effectiveFrom: "2026-10-01", effectiveTo: null, status: "ACTIVE", components: [{ componentKey: "BASIC", displayName: "Basic salary", category: "EARNING", amountType: "FIXED_AMOUNT", frequency: "MONTHLY", occurrenceType: "RECURRING", taxability: "TAXABLE", value: 50000 }] }]);
  vi.mocked(payrollApi.createProfile).mockResolvedValue({} as payrollApi.Profile);
  wizard();
  await waitFor(() => expect((screen.getByLabelText("Employee code") as HTMLInputElement).value).toBe("EMP-002"));
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Lovelace" } });
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "ada@example.test" } });
  fireEvent.change(screen.getByLabelText("Joining date"), { target: { value: "2026-10-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

  await screen.findByRole("heading", { name: "Payroll settings for Ada Lovelace" });
  expect(screen.getByRole("status").textContent).toBe("?employee=EMP-002");
  expect(workforceApi.createEmployee).toHaveBeenCalledOnce();
  expect(workforceApi.createEmployee).toHaveBeenCalledWith(expect.objectContaining({ employeeCode: "EMP-002", status: "ACTIVE" }));
  await waitFor(() => expect((screen.getByLabelText("Currency") as HTMLInputElement).value).toBe("INR"));
  expect((screen.getByLabelText("Payroll start date") as HTMLInputElement).value).toBe("2026-10-01");
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

  await screen.findByRole("heading", { name: "Salary for Ada Lovelace" });
  expect(payrollApi.createPayrollEmployee).toHaveBeenCalledWith(expect.objectContaining({ employeeCode: "EMP-002", currency: "INR", payFrequency: "MONTHLY", effectiveFrom: "2026-10-01" }));
  fireEvent.click(await screen.findByLabelText("Basic salary", { selector: "input[type=checkbox]" }));
  fireEvent.change(screen.getByLabelText("Basic salary amount in INR"), { target: { value: "50000" } });
  expect(screen.getByLabelText("Estimated pay").textContent).toContain("50,000");
  fireEvent.click(screen.getByRole("button", { name: "Save salary and finish" }));

  await screen.findByRole("heading", { name: "Ada Lovelace is ready" });
  expect(payrollApi.createProfile).toHaveBeenCalledWith("EMP-002", expect.objectContaining({ profileKey: "SAL-20261001", currency: "INR", effectiveFrom: "2026-10-01", components: [{ componentKey: "BASIC", value: 50000 }] }));
  expect(workforceApi.createEmployee).toHaveBeenCalledOnce();
  expect(payrollApi.createPayrollEmployee).toHaveBeenCalledOnce();
});

it("resumes at the first unfinished step without recreating earlier records", async () => {
  vi.mocked(payrollApi.getPayrollEmployee).mockResolvedValue(enrolled);
  wizard("?employee=emp-002");
  await screen.findByRole("heading", { name: "Salary for Ada Lovelace" });
  expect(workforceApi.getEmployee).toHaveBeenCalledWith("EMP-002");
  expect(workforceApi.createEmployee).not.toHaveBeenCalled();
  expect(payrollApi.createPayrollEmployee).not.toHaveBeenCalled();
});

it("treats an existing payroll enrollment as done instead of failing", async () => {
  vi.mocked(payrollApi.getPayrollEmployee).mockRejectedValueOnce(new ApiError(404, "Payroll employee not found")).mockResolvedValue(enrolled);
  vi.mocked(payrollApi.createPayrollEmployee).mockRejectedValue(new ApiError(409, "Payroll employee already exists"));
  wizard("?employee=EMP-002");
  await screen.findByRole("heading", { name: "Payroll settings for Ada Lovelace" });
  fireEvent.change(screen.getByLabelText("Currency"), { target: { value: "INR" } });
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await screen.findByRole("heading", { name: "Salary for Ada Lovelace" });
  expect(screen.queryByRole("alert")).toBeNull();
});

it("explains a duplicate employee code and keeps the entered details", async () => {
  vi.mocked(workforceApi.createEmployee).mockRejectedValue(new ApiError(409, "Employee code already exists"));
  wizard();
  await waitFor(() => expect((screen.getByLabelText("Employee code") as HTMLInputElement).value).toBe("EMP-002"));
  fireEvent.change(screen.getByLabelText("Employee code"), { target: { value: "EMP-001" } });
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Lovelace" } });
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "ada@example.test" } });
  fireEvent.change(screen.getByLabelText("Joining date"), { target: { value: "2026-10-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Employee code EMP-001 is already in use");
  expect((screen.getByLabelText("First name") as HTMLInputElement).value).toBe("Ada");
});

it("lets the admin skip payroll and shows what is still missing", async () => {
  vi.mocked(payrollApi.getPayrollEmployee).mockRejectedValue(new ApiError(404, "Payroll employee not found"));
  wizard("?employee=EMP-002");
  fireEvent.click(await screen.findByRole("button", { name: "Skip payroll for now" }));
  await screen.findByRole("heading", { name: "Ada Lovelace is added" });
  expect(screen.getByText(/this person cannot be paid yet/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Finish payroll setup" })).toBeTruthy();
});
