import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { EmployeeSetupWizard } from "./EmployeeSetupWizard";
import { EMPLOYMENT_TYPES } from "./EmployeeFields";
import * as workforceApi from "../../features/workforce/workforceApi";
import * as payrollApi from "../../features/payroll/payrollApi";
import * as adminApi from "../../features/admin/adminApi";
import { ApiError } from "../../api/types";
import { chooseOption } from "../../test/dropdown";

// Synthetic, format-valid test data only.
const ada = { employeeCode: "EMP-002", firstName: "Ada", middleName: null, lastName: "Lovelace", workEmail: "ada@example.test", phone: null, phoneCountry: null, employmentType: "FULL_TIME" as const, joiningDate: "2026-10-01", status: "ACTIVE" as workforceApi.EmploymentStatus, departmentKey: null, designationKey: null, reportingManagerEmployeeCode: null };
const existing = { ...ada, employeeCode: "EMP-001", firstName: "Grace", lastName: "Hopper", workEmail: "grace@example.test" };
const enrolled = { employeeCode: "EMP-002", currency: "INR", payFrequency: "MONTHLY" as const, effectiveFrom: "2026-10-01", status: "ACTIVE" as const, payGroup: null, workState: null, workLocation: null };
const section = (key: string, title: string, status: payrollApi.SectionStatus, missing: string[] = []) => ({ key, title, status, missing });
function setupOf(salaryConfigured: boolean, overrides: Partial<payrollApi.PayrollSetup> = {}): payrollApi.PayrollSetup {
  return {
    enrollment: enrolled, statutoryProfile: null, salaryConfigured,
    sections: [section("enrollment", "Payroll enrollment", "COMPLETE"), section("payment", "Payment method", "NOT_STARTED", ["Payment method"]),
      section("tax", "PAN and tax regime", "PENDING_VERIFICATION"), section("salary", "Salary", salaryConfigured ? "COMPLETE" : "NOT_STARTED")],
    readiness: { readyForPayroll: salaryConfigured, setupComplete: false, blockers: salaryConfigured ? [] : ["No active salary. Add pay components before including this employee in a pay run"], warnings: ["Payment method: not started"] },
    ...overrides,
  };
}
const basic = { componentKey: "BASIC", displayName: "Basic salary", category: "EARNING" as const, amountType: "FIXED_AMOUNT" as const, occurrenceType: "RECURRING" as const, taxability: "TAXABLE" as const, status: "ACTIVE" as const };
const page = (codes: typeof existing[]) => ({ content: codes, page: 0, size: 100, totalElements: codes.length, totalPages: 1, sort: "firstName", direction: "ASC" });

const org = vi.hoisted(() => ({ organizationName: "" }));
vi.mock("../../auth/AuthProvider", () => ({ useAuth: () => ({ organization: { organizationId: "org", membershipRole: "ADMIN", organizationName: org.organizationName } }) }));
vi.mock("../../workspace/WorkspaceProvider", () => ({ useWorkspace: () => ({ workspace: { key: "main", products: [{ key: "workforce" }, { key: "payroll" }] } }) }));
vi.mock("../../features/admin/adminApi", () => ({ getOrganization: vi.fn() }));
vi.mock("../../features/workforce/workforceApi", () => ({
  getEmployees: vi.fn(), getDepartments: vi.fn(), getDesignations: vi.fn(), getEmployee: vi.fn(), createEmployee: vi.fn(),
}));
vi.mock("../../features/payroll/payrollApi", () => ({
  getPayrollSetup: vi.fn(), getProfiles: vi.fn(), createPayrollEmployee: vi.fn(), updatePayrollEmployee: vi.fn(), saveStatutoryProfile: vi.fn(),
  getComponents: vi.fn(), createProfile: vi.fn(), createComponent: vi.fn(), getStatutoryEstimate: vi.fn(),
}));

function Location() { const location = useLocation(); return <output data-testid="location">{location.search}</output>; }
const wizard = (search = "") => render(<MemoryRouter initialEntries={[`/workforce/employees/new${search}`]}><Location /><Routes><Route path="/workforce/employees/new" element={<EmployeeSetupWizard />} /></Routes></MemoryRouter>);
const code = () => screen.getByLabelText("Employee code") as HTMLInputElement;
const location = () => screen.getByTestId("location").textContent;
const missing = () => new ApiError(404, "Payroll employee not found");

beforeEach(() => {
  vi.mocked(adminApi.getOrganization).mockResolvedValue({ settings: { currency: "INR", locale: "en-IN" } } as adminApi.Organization);
  vi.mocked(workforceApi.getDepartments).mockResolvedValue([]);
  vi.mocked(workforceApi.getDesignations).mockResolvedValue([]);
  vi.mocked(payrollApi.getProfiles).mockResolvedValue([]);
  vi.mocked(workforceApi.getEmployees).mockResolvedValue(page([existing]));
  vi.mocked(workforceApi.getEmployee).mockResolvedValue(ada);
  vi.mocked(payrollApi.getComponents).mockResolvedValue([basic]);
  vi.mocked(payrollApi.updatePayrollEmployee).mockResolvedValue(enrolled);
  vi.mocked(payrollApi.saveStatutoryProfile).mockResolvedValue(setupOf(false));
});
// Reset (not just clear) so unconsumed one-off responses cannot leak into the next test.
afterEach(() => { cleanup(); vi.resetAllMocks(); org.organizationName = ""; });

async function fillDetails() {
  await waitFor(() => expect(code().value).toBe("EMP-002"));
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Lovelace" } });
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "ada@example.test" } });
  fireEvent.change(screen.getByLabelText("Joining date"), { target: { value: "2026-10-01" } });
}

it("walks through details, payroll setup, salary and an honest review, creating each record once", async () => {
  vi.mocked(workforceApi.createEmployee).mockResolvedValue(ada);
  vi.mocked(payrollApi.getPayrollSetup).mockRejectedValueOnce(missing()).mockResolvedValueOnce(setupOf(false)).mockResolvedValue(setupOf(true));
  vi.mocked(payrollApi.createPayrollEmployee).mockResolvedValue(enrolled);
  vi.mocked(payrollApi.createProfile).mockResolvedValue({} as payrollApi.Profile);
  wizard();
  await fillDetails();
  expect(screen.queryByText(/never reused/i)).toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "+91 98765-43210" } });
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

  await screen.findByRole("heading", { name: "Payroll setup for Ada Lovelace" });
  expect(location()).toBe("?employee=EMP-002");
  expect(workforceApi.createEmployee).toHaveBeenCalledOnce();
  expect(workforceApi.createEmployee).toHaveBeenCalledWith(expect.objectContaining({ employeeCode: "EMP-002", status: "ACTIVE", phone: "+919876543210", phoneCountry: "IN", employmentType: "FULL_TIME" }));
  expect((screen.getByLabelText("Currency") as HTMLInputElement).value).toBe("INR");
  fireEvent.change(screen.getByLabelText("PAN"), { target: { value: "ABCDE1234F" } });
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

  await screen.findByRole("heading", { name: "Salary for Ada Lovelace" });
  expect(payrollApi.createPayrollEmployee).toHaveBeenCalledWith(expect.objectContaining({ employeeCode: "EMP-002", currency: "INR", payFrequency: "MONTHLY", effectiveFrom: "2026-10-01" }));
  expect(payrollApi.saveStatutoryProfile).toHaveBeenCalledWith("EMP-002", expect.objectContaining({ pan: "ABCDE1234F", panVerified: false, pfApplicability: "UNDECIDED" }));
  // Sensitive values travel in request bodies only, never in the URL.
  expect(location()).toBe("?employee=EMP-002&step=salary");

  fireEvent.click(await screen.findByRole("button", { name: "＋ Add pay component" }));
  chooseOption("Pay component", /Basic salary/);
  fireEvent.change(screen.getByLabelText("Basic salary amount in INR"), { target: { value: "50000" } });
  const breakdown = screen.getByLabelText("Estimated pay");
  expect(breakdown.textContent).toContain("50,000");
  expect(within(breakdown).getByText("Estimated net pay")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Save salary and review" }));

  await screen.findByRole("heading", { name: "Ada Lovelace: Salary configured · payroll setup incomplete" });
  expect(payrollApi.createProfile).toHaveBeenCalledWith("EMP-002", expect.objectContaining({ profileKey: "SAL-20261001", currency: "INR", effectiveFrom: "2026-10-01", components: [{ componentKey: "BASIC", value: 50000 }] }));
  expect(screen.getByRole("link", { name: "Go to pay runs" })).toBeTruthy();
  expect(screen.getByText("Pending verification")).toBeTruthy();
  expect(workforceApi.createEmployee).toHaveBeenCalledOnce();
  expect(payrollApi.createPayrollEmployee).toHaveBeenCalledOnce();
});

it("resumes at the first unfinished step without recreating earlier records", async () => {
  vi.mocked(payrollApi.getPayrollSetup).mockResolvedValue(setupOf(false));
  wizard("?employee=emp-002");
  await screen.findByRole("heading", { name: "Salary for Ada Lovelace" });
  expect(workforceApi.getEmployee).toHaveBeenCalledWith("EMP-002");
  expect(workforceApi.createEmployee).not.toHaveBeenCalled();
  expect(payrollApi.createPayrollEmployee).not.toHaveBeenCalled();
});

it("treats an existing payroll enrollment as done instead of failing", async () => {
  vi.mocked(payrollApi.getPayrollSetup).mockRejectedValueOnce(missing()).mockResolvedValue(setupOf(false));
  vi.mocked(payrollApi.createPayrollEmployee).mockRejectedValue(new ApiError(409, "Payroll employee already exists"));
  wizard("?employee=EMP-002");
  await screen.findByRole("heading", { name: "Payroll setup for Ada Lovelace" });
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await screen.findByRole("heading", { name: "Salary for Ada Lovelace" });
  expect(payrollApi.saveStatutoryProfile).toHaveBeenCalledOnce();
});

it("moves an untouched suggested code to the next number if another admin took it", async () => {
  const codes = [existing];
  vi.mocked(workforceApi.getEmployees).mockImplementation(async () => page(codes));
  vi.mocked(workforceApi.createEmployee)
    .mockImplementationOnce(async () => { codes.push({ ...existing, employeeCode: "EMP-002" }); throw new ApiError(409, "Employee code already exists"); })
    .mockResolvedValueOnce({ ...ada, employeeCode: "EMP-003" });
  vi.mocked(workforceApi.getEmployee).mockImplementation(async (value) => value === "EMP-002" ? { ...existing, employeeCode: "EMP-002" } : { ...ada, employeeCode: "EMP-003" });
  vi.mocked(payrollApi.getPayrollSetup).mockRejectedValue(missing());
  wizard();
  await fillDetails();
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await screen.findByRole("heading", { name: "Payroll setup for Ada Lovelace" });
  expect(vi.mocked(workforceApi.createEmployee).mock.calls.map(([body]) => (body as { employeeCode: string }).employeeCode)).toEqual(["EMP-002", "EMP-003"]);
});

it("keeps a code the admin typed and explains the conflict instead of changing it", async () => {
  vi.mocked(workforceApi.createEmployee).mockRejectedValue(new ApiError(409, "Employee code already exists"));
  vi.mocked(workforceApi.getEmployee).mockResolvedValue({ ...existing, employeeCode: "LAB-7" });
  wizard();
  await fillDetails();
  fireEvent.change(code(), { target: { value: "lab-7" } });
  expect(code().value).toBe("LAB-7");
  expect(screen.getByRole("button", { name: "Use EMP-002" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await screen.findByText("LAB-7 was just taken. Use EMP-002 or enter another code.");
  expect(workforceApi.createEmployee).toHaveBeenCalledOnce();
  expect(code().value).toBe("LAB-7");
});

it("flags a code that already belongs to someone, including former employees, before saving", async () => {
  vi.mocked(workforceApi.getEmployees).mockResolvedValue(page([existing, { ...existing, employeeCode: "EMP-009", firstName: "Alan", lastName: "Turing", status: "TERMINATED" }]));
  wizard();
  await waitFor(() => expect(code().value).toBe("EMP-010"));
  fireEvent.change(code(), { target: { value: "EMP-009" } });
  expect(screen.getByRole("alert").textContent).toBe("EMP-009 is already used by Alan Turing (no longer employed).");
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  expect(workforceApi.createEmployee).not.toHaveBeenCalled();
});

it("reuses the employee from an earlier attempt whose response was lost instead of creating a second one", async () => {
  vi.mocked(workforceApi.createEmployee)
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockRejectedValueOnce(new ApiError(409, "Employee code already exists"));
  vi.mocked(workforceApi.getEmployee).mockResolvedValue(ada);
  vi.mocked(payrollApi.getPayrollSetup).mockRejectedValue(missing());
  wizard();
  await fillDetails();
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await screen.findByText("Unable to save employee details.");
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await screen.findByRole("heading", { name: "Payroll setup for Ada Lovelace" });
  expect(vi.mocked(workforceApi.createEmployee).mock.calls.map(([body]) => (body as { employeeCode: string }).employeeCode)).toEqual(["EMP-002", "EMP-002"]);
});

it("lets the admin skip payroll and shows what is still missing without claiming completion", async () => {
  vi.mocked(payrollApi.getPayrollSetup).mockRejectedValue(missing());
  wizard("?employee=EMP-002");
  fireEvent.click(await screen.findByRole("button", { name: "Skip payroll for now" }));
  await screen.findByRole("heading", { name: "Ada Lovelace: Employee created · payroll setup incomplete" });
  expect(screen.getByText(/cannot be paid yet/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Set up payroll" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Go to pay runs" })).toBeNull();
});

it("offers consultant alongside the other employment types", () => {
  expect(EMPLOYMENT_TYPES).toEqual([
    { value: "FULL_TIME", label: "Full-time" }, { value: "PART_TIME", label: "Part-time" },
    { value: "CONTRACT", label: "Contract" }, { value: "INTERN", label: "Intern" }, { value: "CONSULTANT", label: "Consultant" },
  ]);
});

it("suggests employee codes with the company prefix", async () => {
  org.organizationName = "Lexorion";
  vi.mocked(workforceApi.getEmployees).mockResolvedValue(page([{ ...existing, employeeCode: "LEX-004" }, existing]));
  wizard();
  await waitFor(() => expect(code().value).toBe("LEX-005"));
});
