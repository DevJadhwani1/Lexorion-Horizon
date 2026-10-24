import { expect, it } from "vitest";
import { accessDecision, finishDecision, nextPayrollAction, operationalAttention, organizationDetails, pendingInvitations, workspaceChecklist, workspaceProducts } from "./readiness";

const org = { name: "Acme", primaryEmail: "admin@acme.test" };

it("does not treat default country or currency as organization setup", () => {
  expect(organizationDetails(org).state).toBe("ACTION_REQUIRED");
  expect(organizationDetails({ ...org, primaryPhone: "+1 555 0100" }).state).toBe("COMPLETE");
  expect(organizationDetails(null).state).toBe("NOT_STARTED");
});

it("requires the plan's products and never invents attached names", () => {
  const empty = workspaceProducts([{ key: "main", displayName: "Main", status: "ACTIVE", products: [] }], ["workforce", "payroll"]);
  expect(empty.state).toBe("ACTION_REQUIRED");
  expect(empty.explanation).toContain("Workforce");
  expect(empty.explanation).not.toContain("attached with Workforce, Payroll");
  const ready = workspaceProducts([{ key: "main", displayName: "Main", status: "ACTIVE", products: [{ key: "finance", displayName: "Finance" }] }], ["finance"]);
  expect(ready.state).toBe("COMPLETE");
  expect(ready.explanation).toContain("Finance");
});

it("counts only pending invitations and accepts a persisted solo decision", () => {
  expect(pendingInvitations([{ status: "ACCEPTED" }, { status: "REVOKED" }, { status: "EXPIRED" }, { status: "PENDING" }])).toHaveLength(1);
  expect(accessDecision([{ status: "ACTIVE" }], [{ status: "ACCEPTED" }], false).state).toBe("ACTION_REQUIRED");
  expect(accessDecision([{ status: "ACTIVE" }], [{ status: "PENDING" }], false).state).toBe("COMPLETE");
  expect(accessDecision([{ status: "ACTIVE" }], [], true).state).toBe("COMPLETE");
  expect(accessDecision([{ status: "ACTIVE" }, { status: "ACTIVE" }], [], false).state).toBe("COMPLETE");
});

it("does not finish setup because a workspace is selected", () => {
  const details = organizationDetails(org);
  const blocked = finishDecision(false, [details]);
  expect(blocked.state).toBe("BLOCKED");
  expect(blocked.explanation).toContain("Opening a workspace does not finish setup");
  const open = organizationDetails({ ...org, legalName: "Acme Ltd" });
  expect(finishDecision(false, [open]).state).toBe("ACTION_REQUIRED");
  expect(finishDecision(true, [open]).state).toBe("COMPLETE");
});

it("separates a failed run, a draft, a missing salary, and optional departments", () => {
  const action = nextPayrollAction({ readiness: { activeEmployees: 1, employeesWithCompensation: 0, nextEmployeeCode: "EMP-1" }, runs: [{ payRunKey: "FAIL", status: "FAILED", failureMessage: "No salary" }, { payRunKey: "DRAFT-1", status: "DRAFT" }], names: {}, guided: false });
  expect(action.action).toBe("Review failed run");
  expect(action.featuredKey).toBe("FAIL");
  const alerts = operationalAttention({
    organization: org, workspaces: [], requiredProductKeys: [], invitations: [], workforceEnabled: true, payrollEnabled: true, financeEnabled: true,
    employeeCount: 1, departmentCount: 0, activePayrollEmployees: 1, employeesWithCompensation: 0, nextEmployeeCode: "EMP-1", unenrolledEmployeeCode: null,
    runs: [{ payRunKey: "FAIL", status: "FAILED", failureMessage: "No salary" }, { payRunKey: "DRAFT-1", status: "DRAFT" }],
    statutoryDecisionsOpen: 1, detailsAwaitingVerification: 0, pendingInvitationCount: 0, overdueInvoices: 2, activeClients: 0,
  }, action.featuredKey);
  expect(alerts.some((entry) => entry.explanation.includes("FAIL"))).toBe(false);
  expect(alerts.some((entry) => entry.explanation.includes("DRAFT-1"))).toBe(true);
  expect(alerts.some((entry) => entry.key === "salary")).toBe(true);
  expect(alerts.some((entry) => entry.explanation.includes("overdue"))).toBe(true);
  const checklist = workspaceChecklist({
    organization: { ...org, industry: "Software" }, workspaces: [{ key: "main", displayName: "Main", status: "ACTIVE", products: [{ key: "workforce", displayName: "Workforce" }, { key: "payroll", displayName: "Payroll" }, { key: "finance", displayName: "Finance" }] }],
    requiredProductKeys: ["workforce", "payroll"], invitations: [], workforceEnabled: true, payrollEnabled: true, financeEnabled: true,
    employeeCount: 1, departmentCount: 0, activePayrollEmployees: 1, employeesWithCompensation: 1, nextEmployeeCode: null, unenrolledEmployeeCode: null,
    runs: [], statutoryDecisionsOpen: 0, detailsAwaitingVerification: 0, pendingInvitationCount: 0, overdueInvoices: 0, activeClients: 0,
  });
  expect(checklist.find((entry) => entry.key === "departments")?.required).toBe(false);
  expect(checklist.find((entry) => entry.key === "compensation")?.state).toBe("COMPLETE");
  expect(checklist.find((entry) => entry.key === "finance")?.required).toBe(false);
});
