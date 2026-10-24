import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chooseOption } from "../../test/dropdown";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    createDepartment: vi.fn(async (body: any) => ({ key: body.key, name: body.name, status: "ACTIVE", parentDepartmentKey: body.parentDepartmentKey ?? null })),
    updateDepartment: vi.fn(async (key: string, body: any) => ({ key, name: body.name ?? "Updated", status: body.status ?? "ACTIVE", parentDepartmentKey: body.parentDepartmentKey ?? null })),
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
    expect(screen.getByRole("combobox", { name: "Department (optional)" }).textContent).toContain("Engineering");
    chooseOption("Department (optional)", "No department");
    chooseOption("Designation (optional)", "No designation");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(workforceApi.updateEmployee).toHaveBeenCalledWith("EMP-001", expect.objectContaining({ departmentKey: null, designationKey: null, reportingManagerEmployeeCode: null })));
  });

  it("offers guided payroll setup when the employee is not enrolled", async () => {
    vi.mocked(payrollApi.getPayrollEmployee).mockRejectedValue(new ApiError(404, "Payroll employee not found"));
    profile();
    expect((await screen.findByRole("link", { name: "Set up payroll" })).getAttribute("href")).toBe("/workforce/employees/new?employee=EMP-001");
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

describe("departments page", () => {
  it("renders breadcrumbs, page hierarchy, and primary action", async () => {
    vi.mocked(workforceApi.getDepartments).mockResolvedValueOnce([
      { key: "engineering", name: "Engineering", status: "ACTIVE", parentDepartmentKey: null },
      { key: "frontend", name: "Frontend", status: "ACTIVE", parentDepartmentKey: "engineering" },
    ]);
    render(
      <MemoryRouter initialEntries={["/workforce/departments"]}>
        <Routes>
          <Route path="/workforce/departments" element={<WorkforcePage sectionKey="departments" />} />
        </Routes>
      </MemoryRouter>
    );

    // Breadcrumbs
    const breadcrumb = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb).toBeTruthy();
    expect(within(breadcrumb).getByText("Organization")).toBeTruthy();
    expect(within(breadcrumb).getByText("Workforce")).toBeTruthy();
    expect(within(breadcrumb).getByText("Departments")).toBeTruthy();

    // Page title & description
    expect(screen.getByRole("heading", { level: 1, name: "Departments" })).toBeTruthy();
    expect(screen.getByText("Departments organize employees and may have parent-child relationships.")).toBeTruthy();

    // Primary action in header
    expect(screen.getByRole("button", { name: "Add department" })).toBeTruthy();

    // Table rows & hierarchy
    expect(screen.getAllByText("Engineering").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Frontend")).toBeTruthy();
    expect(screen.getByText("Sub-department of Engineering")).toBeTruthy();
  });

  it("shows a compact empty state when no departments exist", async () => {
    vi.mocked(workforceApi.getDepartments).mockResolvedValueOnce([]);
    render(
      <MemoryRouter initialEntries={["/workforce/departments"]}>
        <Routes>
          <Route path="/workforce/departments" element={<WorkforcePage sectionKey="departments" />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole("heading", { level: 1, name: "Departments" });
    expect(await screen.findByRole("heading", { level: 3, name: "No departments yet" })).toBeTruthy();
    expect(screen.getByText(/Add your first department to get started\./)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Add department" }).length).toBeGreaterThanOrEqual(1);
  });

  it("creates a department with auto-generated short code and optional parent", async () => {
    vi.mocked(workforceApi.getDepartments).mockResolvedValue([
      { key: "engineering", name: "Engineering", status: "ACTIVE", parentDepartmentKey: null },
    ]);
    render(
      <MemoryRouter initialEntries={["/workforce/departments"]}>
        <Routes>
          <Route path="/workforce/departments" element={<WorkforcePage sectionKey="departments" />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole("heading", { level: 1, name: "Departments" });
    fireEvent.click(screen.getByRole("button", { name: "Add department" }));

    // Modal dialog appears
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByRole("heading", { name: "Add department" })).toBeTruthy();

    // Fill name - auto-generates short code
    const nameInput = screen.getByLabelText(/Department name/);
    fireEvent.change(nameInput, { target: { value: "Quality Assurance" } });
    const keyInput = screen.getByLabelText(/Short code/);
    expect((keyInput as HTMLInputElement).value).toBe("quality-assurance");

    // Select parent department
    chooseOption("Parent department", "Engineering");

    // Submit form
    fireEvent.click(within(dialog).getByRole("button", { name: "Add department" }));

    await waitFor(() => {
      expect(workforceApi.createDepartment).toHaveBeenCalledWith({
        name: "Quality Assurance",
        key: "quality-assurance",
        parentDepartmentKey: "engineering",
      });
    });

    expect(await screen.findByText('Department "Quality Assurance" created successfully.')).toBeTruthy();
  });

  it("allows editing an existing department and deactivating it", async () => {
    vi.mocked(workforceApi.getDepartments).mockResolvedValue([
      { key: "engineering", name: "Engineering", status: "ACTIVE", parentDepartmentKey: null },
    ]);
    render(
      <MemoryRouter initialEntries={["/workforce/departments"]}>
        <Routes>
          <Route path="/workforce/departments" element={<WorkforcePage sectionKey="departments" />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Engineering");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Edit department" })).toBeTruthy();

    const nameInput = screen.getByLabelText(/Department name/);
    fireEvent.change(nameInput, { target: { value: "Engineering & Platform" } });

    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(workforceApi.updateDepartment).toHaveBeenCalledWith("engineering", {
        name: "Engineering & Platform",
        parentDepartmentKey: null,
      });
    });

    // Toggle status (Deactivate)
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    // In dialog confirm
    const confirmDialog = await screen.findByRole("dialog");
    const confirmButton = within(confirmDialog).getByRole("button", { name: "Deactivate" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(workforceApi.updateDepartment).toHaveBeenCalledWith("engineering", {
        status: "INACTIVE",
      });
    });
  });

  it("handles duplicate keys and API failures without losing form state", async () => {
    vi.mocked(workforceApi.getDepartments).mockResolvedValue([
      { key: "engineering", name: "Engineering", status: "ACTIVE", parentDepartmentKey: null },
    ]);
    vi.mocked(workforceApi.createDepartment).mockRejectedValueOnce(new ApiError(409, "Department key already exists"));

    render(
      <MemoryRouter initialEntries={["/workforce/departments"]}>
        <Routes>
          <Route path="/workforce/departments" element={<WorkforcePage sectionKey="departments" />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole("heading", { level: 1, name: "Departments" });
    fireEvent.click(screen.getByRole("button", { name: "Add department" }));

    const dialog = await screen.findByRole("dialog");
    const nameInput = screen.getByLabelText(/Department name/);
    fireEvent.change(nameInput, { target: { value: "New Team" } });
    const keyInput = screen.getByLabelText(/Short code/);
    fireEvent.change(keyInput, { target: { value: "custom-key" } });

    fireEvent.click(within(dialog).getByRole("button", { name: "Add department" }));

    // Error shown
    expect(await screen.findByText("Department key already exists")).toBeTruthy();
    // Values retained
    expect((nameInput as HTMLInputElement).value).toBe("New Team");
    expect((keyInput as HTMLInputElement).value).toBe("custom-key");
  });
});

