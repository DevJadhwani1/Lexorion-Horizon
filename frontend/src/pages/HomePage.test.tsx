import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "./HomePage";
import * as payroll from "../features/payroll/payrollApi";
const state = vi.hoisted(() => ({ workspace: { key: "main", displayName: "Main", products: [{ key: "workforce", displayName: "Workforce" }, { key: "payroll", displayName: "Payroll" }] }, role: "ADMIN" }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { firstName: "Admin", email: "admin@qa.test" }, organizations: [{}], organization: { slug: "alpha", organizationName: "Alpha", membershipRole: state.role, organizationStatus: "ACTIVE" } }) }));
vi.mock("../workspace/WorkspaceProvider", () => ({ useWorkspace: () => ({ workspace: state.workspace, workspaces: [state.workspace], loading: false }) }));
vi.mock("../features/admin/adminApi", () => ({ getOrganization: vi.fn(async () => ({ status: "ACTIVE" })) }));
vi.mock("../features/admin/workspaceApi", () => ({ getOrganizationWorkspaces: vi.fn(async () => [{ status: "ACTIVE" }]) }));
vi.mock("../features/entitlements/entitlementApi", () => ({ getEffectiveEntitlements: vi.fn(async () => []), getEntitlementLimit: () => null }));
vi.mock("../features/workforce/workforceApi", () => ({ getEmployees: vi.fn(async () => ({ content: [], totalElements: 0, totalPages: 1 })), getDepartments: vi.fn(async () => []), getDesignations: vi.fn(async () => []), getMe: vi.fn(async () => ({ employeeCode: "ME", status: "ACTIVE" })), getTeam: vi.fn() }));
vi.mock("../features/payroll/payrollApi", () => ({ getPayrollEmployees: vi.fn(async () => []), getPayrollReadiness: vi.fn(), getPayRuns: vi.fn() }));
const renderHome = () => render(<MemoryRouter><HomePage /></MemoryRouter>);
beforeEach(() => { state.role = "ADMIN"; state.workspace.key = "main"; state.workspace.displayName = "Main"; vi.mocked(payroll.getPayrollReadiness).mockResolvedValue({ activeEmployees: 0, employeesWithCompensation: 0, nextEmployeeCode: null }); vi.mocked(payroll.getPayRuns).mockResolvedValue({ content: [] } as never); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("shows useful empty setup without making optional organization details mandatory", async () => {
  renderHome(); await screen.findByRole("heading", { name: "Workspace setup" });
  expect(screen.getByText(/Optional: organize employees/)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Configure an employee for payroll" })).toBeTruthy();
  expect(screen.queryByText(/No immediate setup gaps/)).toBeNull();
});
it("identifies missing compensation without claiming a period is ready", async () => {
  vi.mocked(payroll.getPayrollReadiness).mockResolvedValue({ activeEmployees: 2, employeesWithCompensation: 1, nextEmployeeCode: "EMP-2" });
  renderHome(); await screen.findByRole("heading", { name: "Add compensation for EMP-2" });
  expect(screen.getByRole("link", { name: "Set up compensation" }).getAttribute("href")).toContain("employee=EMP-2");
  expect(screen.getByText(/Configuration counts are not a pay-period approval/)).toBeTruthy();
});
it("resumes a failed run and links to the latest finalized result", async () => {
  const base = { currency: "USD", netTotal: 100, periodStart: "2026-01-01", periodEnd: "2026-01-31", employeeCount: 1 };
  vi.mocked(payroll.getPayRuns).mockResolvedValue({ content: [{ ...base, payRunKey: "FAIL", status: "FAILED", failureMessage: "No effective compensation profile" }, { ...base, payRunKey: "DONE", status: "FINALIZED" }] } as never);
  renderHome(); await screen.findByRole("link", { name: "Review failed run" });
  expect(screen.getByRole("link", { name: "Review failed run" }).getAttribute("href")).toContain("run=FAIL");
  expect(screen.getByRole("link", { name: "DONE" }).getAttribute("href")).toContain("run=DONE");
});
it("offers retry after a service failure", async () => {
  vi.mocked(payroll.getPayrollReadiness).mockRejectedValueOnce(new Error("Temporarily unavailable"));
  renderHome(); fireEvent.click(await screen.findByRole("button", { name: "Retry overview" }));
  await screen.findByRole("heading", { name: "Workspace setup" });
});
it("ignores delayed overview data from the previous workspace", async () => {
  let finish!: (value: payroll.PayrollReadiness) => void;
  vi.mocked(payroll.getPayrollReadiness).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = renderHome();
  state.workspace = { ...state.workspace, key: "other", displayName: "Other" };
  view.rerender(<MemoryRouter><HomePage /></MemoryRouter>);
  await screen.findByRole("heading", { name: "Configure an employee for payroll" });
  await act(async () => finish({ activeEmployees: 2, employeesWithCompensation: 1, nextEmployeeCode: "OLD-EMPLOYEE" }));
  expect(screen.queryByText(/OLD-EMPLOYEE/)).toBeNull();
});
it("does not call administrator payroll APIs for an employee", async () => {
  state.role = "EMPLOYEE"; renderHome(); await screen.findByText("ME");
  expect(payroll.getPayrollReadiness).not.toHaveBeenCalled(); expect(payroll.getPayRuns).not.toHaveBeenCalled();
});
