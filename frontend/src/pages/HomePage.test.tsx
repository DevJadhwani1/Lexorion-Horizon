import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "./HomePage";
import * as payroll from "../features/payroll/payrollApi";
import * as workforce from "../features/workforce/workforceApi";
const state = vi.hoisted(() => ({
  workspace: { key: "main", displayName: "Main", products: [{ key: "workforce", displayName: "Workforce" }, { key: "payroll", displayName: "Payroll" }] } as any,
  workspaces: [] as any[],
  role: "ADMIN",
  selectWorkspace: vi.fn(),
  workspaceLoading: false,
  workspaceError: "",
  workspaceReload: vi.fn(),
  orgName: "Alpha",
  orgSlug: "alpha",
}));
vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { firstName: "Admin", email: "admin@qa.test" },
    organizations: [{}],
    organization: { slug: state.orgSlug, organizationName: state.orgName, membershipRole: state.role, organizationStatus: "ACTIVE" },
  }),
}));
vi.mock("../workspace/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    workspace: state.workspace,
    workspaces: state.workspaces,
    loading: state.workspaceLoading,
    error: state.workspaceError,
    reload: state.workspaceReload,
    selectWorkspace: state.selectWorkspace,
  }),
}));
vi.mock("../features/admin/adminApi", () => ({
  getOrganization: vi.fn(async () => ({ status: "ACTIVE", name: "Alpha", primaryEmail: "admin@qa.test" })),
  getMembers: vi.fn(async () => []),
  getInvitations: vi.fn(async () => []),
  updateOrganization: vi.fn(async () => ({})),
}));
vi.mock("../features/admin/workspaceApi", () => ({ getOrganizationWorkspaces: vi.fn(async () => [{ status: "ACTIVE" }]) }));
vi.mock("../features/entitlements/entitlementApi", () => ({ getEffectiveEntitlements: vi.fn(async () => []), getEntitlementLimit: () => null }));
vi.mock("../features/workforce/workforceApi", () => ({ getEmployees: vi.fn(async () => ({ content: [], totalElements: 0, totalPages: 1 })), getDepartments: vi.fn(async () => []), getDesignations: vi.fn(async () => []), getMe: vi.fn(async () => ({ employeeCode: "ME", status: "ACTIVE" })), getTeam: vi.fn() }));
vi.mock("../features/payroll/payrollApi", () => ({ getPayrollEmployees: vi.fn(async () => []), getPayrollReadiness: vi.fn(), getPayRuns: vi.fn() }));
const renderHome = () => render(<MemoryRouter><HomePage /></MemoryRouter>);
beforeEach(() => {
  vi.mocked(workforce.getEmployees).mockResolvedValue({ content: [], totalElements: 0, totalPages: 1 } as never);
  state.role = "ADMIN";
  state.orgName = "Alpha";
  state.orgSlug = "alpha";
  state.workspace = { key: "main", displayName: "Main", products: [{ key: "workforce", displayName: "Workforce" }, { key: "payroll", displayName: "Payroll" }] };
  state.workspaces = [state.workspace];
  state.workspaceLoading = false;
  state.workspaceError = "";
  state.workspaceReload = vi.fn();
  state.selectWorkspace = vi.fn();
  vi.mocked(payroll.getPayrollReadiness).mockResolvedValue({ activeEmployees: 0, employeesWithCompensation: 0, nextEmployeeCode: null });
  vi.mocked(payroll.getPayRuns).mockResolvedValue({ content: [] } as never);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("shows useful empty setup without making optional organization details mandatory", async () => {
  renderHome(); await screen.findByRole("heading", { name: "Workspace setup" });
  expect(screen.getByText(/Optional: organize employees/)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Configure an employee for payroll" })).toBeTruthy();
  expect(screen.queryByText(/No immediate setup gaps/)).toBeNull();
});
it("identifies missing compensation without claiming a period is ready", async () => {
  vi.mocked(payroll.getPayrollReadiness).mockResolvedValue({ activeEmployees: 2, employeesWithCompensation: 1, nextEmployeeCode: "EMP-2" });
  vi.mocked(workforce.getEmployees).mockResolvedValue({ content: [{ employeeCode: "EMP-2", firstName: "Grace", lastName: "Hopper", status: "ACTIVE" }], totalElements: 1, totalPages: 1 } as never);
  renderHome(); await screen.findByRole("heading", { name: "Add a salary for Grace Hopper" });
  expect(screen.getByRole("link", { name: "Set up compensation" }).getAttribute("href")).toBe("/app/workforce/employees/new?employee=EMP-2");
  expect(screen.getByText(/This shows setup coverage only/)).toBeTruthy();
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
it("keeps first-run setup resumable before a workspace exists", async () => {
  state.workspace = null;
  state.workspaces = [];
  renderHome();
  await screen.findByRole("heading", { name: "Set up your organization" });
  expect(screen.getByRole("button", { name: /Complete details/ })).toBeTruthy();
  expect(screen.getByRole("link", { name: /Organization settings/ }).getAttribute("href")).toContain("/organization");
});
it("renders operational overview with active workspace context, real metrics, and workforce shortcuts", async () => {
  const workforceApi = await import("../features/workforce/workforceApi");
  vi.mocked(workforceApi.getDepartments).mockResolvedValueOnce([
    { key: "eng", name: "Engineering", status: "ACTIVE", parentDepartmentKey: null },
    { key: "hr", name: "People", status: "ACTIVE", parentDepartmentKey: null },
  ]);
  vi.mocked(workforceApi.getDesignations).mockResolvedValueOnce([
    { key: "lead", name: "Team Lead", status: "ACTIVE", parentDepartmentKey: null },
  ]);
  vi.mocked(workforceApi.getEmployees).mockResolvedValueOnce({
    content: [],
    totalElements: 12,
    totalPages: 1,
  } as any);

  renderHome();
  await screen.findByRole("heading", { name: /Welcome back, Admin/ });
  expect(document.querySelector(".overview-welcome-subtitle")?.textContent).toContain("Workspace Main is active");
  expect(screen.getByRole("heading", { name: "Workforce management" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Manage employees" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Pay runs" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Organization" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Members" })).toBeTruthy();
});
it("presents an interactive workspace selection grid when workspaces exist but none is selected", async () => {
  state.workspace = null;
  state.workspaces = [
    { key: "ops", displayName: "Operations HQ", status: "ACTIVE", products: [{ key: "workforce", displayName: "Workforce" }] },
  ];
  renderHome();
  await screen.findByRole("heading", { name: "Available workspaces" });
  expect(screen.getByText("Operations HQ")).toBeTruthy();
  expect(screen.getByText("ops")).toBeTruthy();
  expect(screen.getByText("Choose an active workspace to open its Workforce and Payroll capabilities.")).toBeTruthy();
  const openBtn = screen.getByRole("button", { name: "Open workspace →" });
  fireEvent.click(openBtn);
  expect(state.selectWorkspace).toHaveBeenCalledWith("ops");
});
it("renders operational attention items when pay run failures occur", async () => {
  const base = { currency: "USD", netTotal: 100, periodStart: "2026-01-01", periodEnd: "2026-01-31", employeeCount: 1 };
  vi.mocked(payroll.getPayRuns).mockResolvedValue({
    content: [{ ...base, payRunKey: "RUN-FAIL", status: "FAILED", failureMessage: "Missing compensation profile" }],
  } as never);
  renderHome();
  await screen.findByRole("heading", { name: "Operational attention" });
  expect(screen.getByText(/Pay run RUN-FAIL failed: Missing compensation profile/)).toBeTruthy();
});
it("handles switching workspaces and updates the active workspace context", async () => {
  const view = renderHome();
  const subtitle = () => document.querySelector(".overview-welcome-subtitle")?.textContent ?? "";
  await waitFor(() => expect(subtitle()).toContain("Workspace Main is active"));

  state.workspace = {
    key: "finance",
    displayName: "Finance Workspace",
    products: [{ key: "payroll", displayName: "Payroll" }],
  };
  view.rerender(<MemoryRouter><HomePage /></MemoryRouter>);
  await waitFor(() => expect(subtitle()).toContain("Workspace Finance Workspace is active"));
});

it("renders onboarding page for a signed-in admin with zero workspaces (Lexorion Client scenario)", async () => {
  state.role = "ADMIN";
  state.orgName = "Lexorion Client";
  state.orgSlug = "lexorion-client";
  state.workspace = null;
  state.workspaces = [];
  renderHome();
  await screen.findByRole("heading", { name: "Set up your organization" });
  expect(screen.queryByText("No active workspaces are available for this organization.")).toBeNull();
  expect(screen.queryByText("Set up a workspace")).toBeNull();
});

it("shows loading notice when workspace access is still resolving", async () => {
  state.workspaceLoading = true;
  state.workspaces = [];
  state.workspace = null;
  renderHome();
  expect(screen.getByText("Loading available workspaces…")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Set up your organization" })).toBeNull();
  expect(screen.queryByText("No active workspaces are available for this organization.")).toBeNull();
});

it("shows workspace error and offers retry when workspace loading fails", async () => {
  state.workspaceLoading = false;
  state.workspaceError = "Failed to load workspaces from server";
  renderHome();
  expect(screen.getByText("Failed to load workspaces from server")).toBeTruthy();
  const retryBtn = screen.getByRole("button", { name: "Retry workspace access" });
  expect(retryBtn).toBeTruthy();
  fireEvent.click(retryBtn);
  expect(state.workspaceReload).toHaveBeenCalled();
  expect(screen.queryByRole("heading", { name: "Set up your organization" })).toBeNull();
});

it("explains who can provision workspaces to non-admin members in zero-workspace organizations", async () => {
  state.role = "EMPLOYEE";
  state.workspace = null;
  state.workspaces = [];
  renderHome();
  await screen.findByText("No active workspaces are available for this organization.");
  expect(screen.getByText("Ask an organization administrator to provision a workspace and grant you access.")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Set up your organization" })).toBeNull();
});
