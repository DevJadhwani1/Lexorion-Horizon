/**
 * One evaluation of setup, operations, payroll eligibility, and statutory readiness.
 * Pay-run eligibility stays on the payroll service. Finish and solo-admin decisions stay on
 * platform organization settings. This module only interprets those responses.
 */

export type ReadinessState = "NOT_STARTED" | "IN_PROGRESS" | "ACTION_REQUIRED" | "BLOCKED" | "COMPLETE" | "SKIPPED";
export type ReadinessKind = "setup" | "operations" | "payroll" | "statutory" | "recommendation";

export interface ReadinessItem {
  key: string;
  title: string;
  state: ReadinessState;
  kind: ReadinessKind;
  required: boolean;
  explanation: string;
  actionLabel?: string;
  actionTo?: string;
}

export interface OrganizationProfile {
  name?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  legalName?: string | null;
  industry?: string | null;
  website?: string | null;
  addressLine1?: string | null;
}

export interface WorkspaceSnapshot {
  key: string;
  displayName: string;
  status: string;
  products: { key: string; displayName: string }[];
}

export interface InvitationSnapshot { status: string }
export interface MemberSnapshot { status?: string }

const PRODUCT_LABELS: Record<string, string> = { workforce: "Workforce", payroll: "Payroll", finance: "Finance" };

export function productLabel(key: string): string {
  return PRODUCT_LABELS[key] ?? key;
}

function text(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

function item(partial: ReadinessItem): ReadinessItem {
  return partial;
}

/** Name, email, and one detail the organization supplied. Country and currency defaults do not count. */
export function organizationDetails(org: OrganizationProfile | null): ReadinessItem {
  const enrichment = Boolean(org && (text(org.primaryPhone) || text(org.legalName) || text(org.industry) || text(org.website) || text(org.addressLine1)));
  const identity = Boolean(org && text(org.name) && text(org.primaryEmail));
  if (identity && enrichment) {
    return item({ key: "organization", title: "Organization details", state: "COMPLETE", kind: "setup", required: true, explanation: "Name, email, and a contact or business detail are saved. Regional defaults stay separate from this step.", actionLabel: "Review organization", actionTo: "/organization" });
  }
  return item({
    key: "organization", title: "Organization details", state: identity ? "ACTION_REQUIRED" : "NOT_STARTED", kind: "setup", required: true,
    explanation: "Add a phone number, legal name, industry, website, or street address. Country and currency defaults do not complete this step.",
    actionLabel: "Complete details", actionTo: "/organization",
  });
}

/** An active workspace must carry every product the current plan enables. An empty product list is never implied. */
export function workspaceProducts(workspaces: WorkspaceSnapshot[], requiredProductKeys: string[]): ReadinessItem {
  const active = workspaces.filter((workspace) => workspace.status === "ACTIVE");
  const productsOf = (workspace: WorkspaceSnapshot) => workspace.products ?? [];
  const required = [...new Set(requiredProductKeys)];
  const covers = (workspace: WorkspaceSnapshot) => required.every((key) => productsOf(workspace).some((product) => product.key === key));
  const ready = required.length === 0
    ? active.find((workspace) => productsOf(workspace).length > 0)
    : active.find(covers);
  if (ready) {
    const names = productsOf(ready).map((product) => product.displayName).join(", ");
    return item({ key: "workspace", title: "Workspace and products", state: "COMPLETE", kind: "setup", required: true, explanation: `${ready.displayName} is active with ${names}.`, actionLabel: "Manage workspace", actionTo: "/organization/workspaces" });
  }
  if (active.length === 0) {
    return item({ key: "workspace", title: "Workspace and products", state: "NOT_STARTED", kind: "setup", required: true, explanation: "Create an active workspace. Workforce, payroll, and finance run inside a workspace, and no product is attached until you choose one.", actionLabel: "Create workspace", actionTo: "/organization/workspaces" });
  }
  const workspace = active[0];
  const attached = new Set(productsOf(workspace).map((product) => product.key));
  const missing = required.filter((key) => !attached.has(key)).map(productLabel);
  const explanation = missing.length > 0
    ? `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} included in the plan and not attached to ${workspace.displayName || "this workspace"}.`
    : `${workspace.displayName} has no products attached, so it cannot open a business area.`;
  return item({ key: "workspace", title: "Workspace and products", state: "ACTION_REQUIRED", kind: "setup", required: true, explanation, actionLabel: "Attach products", actionTo: "/organization/workspaces" });
}

export function pendingInvitations<T extends InvitationSnapshot>(invitations: T[]): T[] {
  return invitations.filter((invitation) => invitation.status === "PENDING");
}

/** Another active member, a live pending invitation, or a persisted solo decision. Terminal invitations do not count. */
export function accessDecision(members: MemberSnapshot[], invitations: InvitationSnapshot[], soloConfirmed: boolean): ReadinessItem {
  const activeMembers = members.filter((member) => !member.status || member.status === "ACTIVE").length;
  const pending = pendingInvitations(invitations).length;
  if (activeMembers > 1) {
    return item({ key: "access", title: "Access", state: "COMPLETE", kind: "setup", required: true, explanation: "More than one active member belongs to this organization.", actionLabel: "Manage members", actionTo: "/people" });
  }
  if (pending > 0) {
    return item({ key: "access", title: "Access", state: "COMPLETE", kind: "setup", required: true, explanation: `${pending} invitation${pending === 1 ? " is" : "s are"} still pending. Accepted, revoked, and expired invitations are not counted.`, actionLabel: "Manage invitations", actionTo: "/organization/invitations" });
  }
  if (soloConfirmed) {
    return item({ key: "access", title: "Access", state: "COMPLETE", kind: "setup", required: true, explanation: "An administrator saved the decision to continue without inviting anyone else.", actionLabel: "Manage invitations", actionTo: "/organization/invitations" });
  }
  return item({ key: "access", title: "Access", state: "ACTION_REQUIRED", kind: "setup", required: true, explanation: "Invite a member or continue as the only administrator. Accepted, revoked, and expired invitations do not complete this step.", actionLabel: "Invite members", actionTo: "/organization/invitations" });
}

/** Finish is complete only when it was saved and the required steps still hold. A selected workspace is ignored. */
export function finishDecision(finished: boolean, required: ReadinessItem[]): ReadinessItem {
  const open = required.filter((step) => step.required && step.state !== "COMPLETE" && step.state !== "SKIPPED");
  if (open.length > 0) {
    return item({ key: "finish", title: "Review and finish", state: "BLOCKED", kind: "setup", required: true, explanation: `Finish stays closed until ${open.map((step) => step.title.toLowerCase()).join(", ")} ${open.length === 1 ? "is" : "are"} complete. Opening a workspace does not finish setup.`, actionLabel: "Finish setup", actionTo: "/onboarding" });
  }
  if (!finished) {
    return item({ key: "finish", title: "Review and finish", state: "ACTION_REQUIRED", kind: "setup", required: true, explanation: "The required steps are complete. Finish setup to record that review.", actionLabel: "Finish setup", actionTo: "/onboarding" });
  }
  return item({ key: "finish", title: "Review and finish", state: "COMPLETE", kind: "setup", required: true, explanation: "Setup was finished, and the required steps still hold.", actionLabel: "Enter workspace", actionTo: "/overview" });
}

export function readinessLabel(entry: ReadinessItem): string {
  if (!entry.required && (entry.state === "NOT_STARTED" || entry.state === "SKIPPED")) return entry.state === "SKIPPED" ? "Skipped" : "Optional";
  switch (entry.state) {
    case "COMPLETE": return "Complete";
    case "SKIPPED": return "Skipped";
    case "BLOCKED": return "Blocked";
    case "ACTION_REQUIRED": return "Action required";
    case "IN_PROGRESS": return "In progress";
    default: return "Not started";
  }
}

export interface PayRunSnapshot {
  payRunKey: string;
  status: string;
  failureMessage?: string | null;
}

export function nextPayrollAction(input: {
  readiness: { activeEmployees: number; employeesWithCompensation: number; nextEmployeeCode: string | null } | null;
  runs: PayRunSnapshot[];
  names: Record<string, string>;
  guided: boolean;
}): { heading: string; detail: string; action: string; to: string; featuredKey: string | null } {
  const run = input.runs.find((item) => item.status !== "FINALIZED");
  if (run) {
    const detail = run.status === "DRAFT"
      ? "Include employees, check their compensation and period, then process this draft."
      : run.status === "CALCULATED"
        ? "Review the calculated totals before finalizing. Finalization creates immutable ledger entries and payslips."
        : run.status === "FAILED"
          ? `Pay run ${run.payRunKey} failed: ${run.failureMessage || "Review the failure and recover this run to draft."}`
          : "Refresh the run to check processing or review its recovery options.";
    const action = run.status === "FAILED" ? "Review failed run" : run.status === "CALCULATED" ? "Review and finalize" : "Continue pay run";
    return { heading: `${run.payRunKey} · ${run.status}`, detail, action, to: `/payroll/runs?run=${encodeURIComponent(run.payRunKey)}`, featuredKey: run.payRunKey };
  }
  const readiness = input.readiness;
  if (!readiness || readiness.activeEmployees === 0) {
    return { heading: "Configure an employee for payroll", detail: "Payroll needs an active employee with a currency, pay frequency and eligibility date.", action: "Configure payroll employees", to: "/payroll/employees", featuredKey: null };
  }
  if (readiness.nextEmployeeCode) {
    const code = readiness.nextEmployeeCode;
    return {
      heading: `Add a salary for ${input.names[code.toUpperCase()] ?? code}`,
      detail: "This employee is set up for payroll but has no salary yet, so they cannot be paid.",
      action: "Set up compensation",
      to: input.guided ? `/workforce/employees/new?employee=${encodeURIComponent(code)}` : `/payroll/compensation?employee=${encodeURIComponent(code)}`,
      featuredKey: null,
    };
  }
  return { heading: "Choose a payroll period", detail: "Create a pay run with dates matching your employees’ pay frequency. Processing calculates all included employees; previewing an individual calculation is optional.", action: "Create a pay run", to: "/payroll/runs", featuredKey: null };
}

export interface OverviewInput {
  organization: OrganizationProfile | null;
  workspaces: WorkspaceSnapshot[];
  requiredProductKeys: string[];
  invitations: InvitationSnapshot[];
  workforceEnabled: boolean;
  payrollEnabled: boolean;
  financeEnabled: boolean;
  employeeCount: number | null;
  departmentCount: number | null;
  activePayrollEmployees: number;
  employeesWithCompensation: number;
  nextEmployeeCode: string | null;
  unenrolledEmployeeCode: string | null;
  runs: PayRunSnapshot[];
  statutoryDecisionsOpen: number;
  detailsAwaitingVerification: number;
  pendingInvitationCount: number;
  overdueInvoices: number | null;
  activeClients: number | null;
}

export function workspaceChecklist(input: OverviewInput): ReadinessItem[] {
  const payrollBase = input.unenrolledEmployeeCode ? `/payroll/employees?employee=${encodeURIComponent(input.unenrolledEmployeeCode)}` : "/payroll/employees";
  const compensationTo = input.nextEmployeeCode ? `/payroll/compensation?employee=${encodeURIComponent(input.nextEmployeeCode)}` : "/payroll/compensation";
  const items: ReadinessItem[] = [
    organizationDetails(input.organization),
    workspaceProducts(input.workspaces, input.requiredProductKeys),
  ];
  if (input.workforceEnabled) {
    items.push(item({
      key: "departments", title: "Departments and designations", state: (input.departmentCount ?? 0) > 0 ? "COMPLETE" : "NOT_STARTED", kind: "recommendation", required: false,
      explanation: (input.departmentCount ?? 0) > 0 ? `${input.departmentCount} departments are configured.` : "Optional: organize employees by team and job title. A department is not required before payroll.",
      actionLabel: "Configure organization details", actionTo: "/workforce/departments",
    }));
    items.push(item({
      key: "employees", title: "Employees", state: (input.employeeCount ?? 0) > 0 ? "COMPLETE" : "NOT_STARTED", kind: "payroll", required: true,
      explanation: (input.employeeCount ?? 0) > 0 ? `${input.employeeCount} active employees.` : "A Workforce employee must exist before payroll enrollment.",
      actionLabel: "Manage employees", actionTo: "/workforce/employees",
    }));
  }
  if (input.payrollEnabled) {
    const enrolled = input.activePayrollEmployees > 0;
    items.push(item({
      key: "enrollment", title: "Payroll employees", state: enrolled ? "COMPLETE" : "ACTION_REQUIRED", kind: "payroll", required: true,
      explanation: enrolled ? `${input.activePayrollEmployees} active payroll employees.` : "Enroll an employee with a currency, pay frequency, and eligibility date before a pay run.",
      actionLabel: "Configure payroll employees", actionTo: payrollBase,
    }));
    const compensationState: ReadinessState = !enrolled ? "BLOCKED" : input.employeesWithCompensation >= input.activePayrollEmployees ? "COMPLETE" : input.employeesWithCompensation > 0 ? "IN_PROGRESS" : "ACTION_REQUIRED";
    items.push(item({
      key: "compensation", title: "Compensation", state: compensationState, kind: "payroll", required: true,
      explanation: !enrolled ? "Add payroll enrollment before a salary. A missing salary blocks that employee from a pay run." : `${input.employeesWithCompensation} of ${input.activePayrollEmployees} active payroll employees have a salary. Effective dates and frequency must match the chosen pay period.`,
      actionLabel: "Review compensation", actionTo: compensationTo,
    }));
    if (input.statutoryDecisionsOpen > 0) {
      items.push(item({
        key: "statutory", title: "Statutory decisions", state: "ACTION_REQUIRED", kind: "statutory", required: false,
        explanation: `${input.statutoryDecisionsOpen} payroll ${input.statutoryDecisionsOpen === 1 ? "employee has" : "employees have"} an unresolved EPF, ESI, professional tax, or labour welfare fund decision. Unresolved is not the same as not applicable, and it does not block a pay run.`,
        actionLabel: "Review payroll employees", actionTo: "/payroll/employees",
      }));
    }
  }
  if (input.financeEnabled) {
    const clients = input.activeClients ?? 0;
    items.push(item({
      key: "finance", title: "Billing clients", state: clients > 0 ? "COMPLETE" : "NOT_STARTED", kind: "recommendation", required: false,
      explanation: clients > 0 ? `${clients} active billing ${clients === 1 ? "client" : "clients"}.` : "Optional: add a billing client when this workspace sends invoices. Finance is separate from payroll.",
      actionLabel: "Add a client", actionTo: "/finance/clients",
    }));
  }
  return items;
}

/** Alerts only. The featured payroll action is omitted so it is not repeated beside Next payroll action. */
export function operationalAttention(input: OverviewInput, featuredPayRunKey: string | null): ReadinessItem[] {
  const alerts: ReadinessItem[] = [];
  if (input.workforceEnabled && input.employeeCount === 0) {
    alerts.push(item({ key: "no-employees", title: "Employees", state: "ACTION_REQUIRED", kind: "operations", required: true, explanation: "No active Workforce employees are configured.", actionLabel: "Review", actionTo: "/workforce/employees" }));
  }
  if (input.payrollEnabled && input.employeeCount !== 0 && input.activePayrollEmployees === 0 && (input.employeeCount ?? 0) > 0) {
    alerts.push(item({ key: "no-payroll", title: "Payroll enrollment", state: "ACTION_REQUIRED", kind: "payroll", required: true, explanation: "No employees are configured for Payroll.", actionLabel: "Review", actionTo: "/payroll/employees" }));
  }
  if (input.unenrolledEmployeeCode && input.activePayrollEmployees > 0) {
    alerts.push(item({ key: "unenrolled", title: "Payroll enrollment", state: "ACTION_REQUIRED", kind: "payroll", required: true, explanation: "Some active Workforce employees are not configured for Payroll.", actionLabel: "Review", actionTo: `/payroll/employees?employee=${encodeURIComponent(input.unenrolledEmployeeCode)}` }));
  }
  if (input.nextEmployeeCode && input.employeesWithCompensation < input.activePayrollEmployees) {
    alerts.push(item({ key: "salary", title: "Salary", state: "ACTION_REQUIRED", kind: "payroll", required: true, explanation: "At least one payroll employee has no salary, so that person cannot be included in a pay run.", actionLabel: "Review", actionTo: `/payroll/compensation?employee=${encodeURIComponent(input.nextEmployeeCode)}` }));
  }
  for (const run of input.runs) {
    if (run.payRunKey === featuredPayRunKey || run.status === "FINALIZED") continue;
    if (run.status === "FAILED") alerts.push(item({ key: `run-${run.payRunKey}`, title: run.payRunKey, state: "BLOCKED", kind: "payroll", required: true, explanation: `Pay run ${run.payRunKey} failed: ${run.failureMessage || "Review the failure and recover this run to draft."}`, actionLabel: "Review", actionTo: `/payroll/runs?run=${encodeURIComponent(run.payRunKey)}` }));
    else if (run.status === "DRAFT" || run.status === "CALCULATED" || run.status === "PROCESSING") alerts.push(item({ key: `run-${run.payRunKey}`, title: run.payRunKey, state: "ACTION_REQUIRED", kind: "payroll", required: true, explanation: `Pay run ${run.payRunKey} is ${run.status}.`, actionLabel: "Review", actionTo: `/payroll/runs?run=${encodeURIComponent(run.payRunKey)}` }));
  }
  if (input.payrollEnabled && input.activePayrollEmployees > 0 && input.employeesWithCompensation >= input.activePayrollEmployees && input.runs.length === 0) {
    alerts.push(item({ key: "no-runs", title: "Pay runs", state: "ACTION_REQUIRED", kind: "payroll", required: true, explanation: "Payroll employees have salaries, but no pay runs have been created.", actionLabel: "Review", actionTo: "/payroll/runs" }));
  }
  if (input.statutoryDecisionsOpen > 0) {
    alerts.push(item({ key: "statutory", title: "Statutory decisions", state: "ACTION_REQUIRED", kind: "statutory", required: false, explanation: `${input.statutoryDecisionsOpen} payroll ${input.statutoryDecisionsOpen === 1 ? "employee has" : "employees have"} an unresolved statutory decision. This does not block a pay run.`, actionLabel: "Review", actionTo: "/payroll/employees" }));
  }
  if (input.detailsAwaitingVerification > 0) {
    alerts.push(item({ key: "verification", title: "Verification", state: "ACTION_REQUIRED", kind: "statutory", required: false, explanation: `${input.detailsAwaitingVerification} payroll ${input.detailsAwaitingVerification === 1 ? "employee has" : "employees have"} saved details that are not verified. Verification does not block calculation.`, actionLabel: "Review", actionTo: "/payroll/employees" }));
  }
  if (input.pendingInvitationCount > 0) {
    alerts.push(item({ key: "invitations", title: "Invitations", state: "ACTION_REQUIRED", kind: "operations", required: true, explanation: `${input.pendingInvitationCount} invitation${input.pendingInvitationCount === 1 ? " is" : "s are"} still pending.`, actionLabel: "Review", actionTo: "/organization/invitations" }));
  }
  if (input.financeEnabled && (input.overdueInvoices ?? 0) > 0) {
    alerts.push(item({ key: "overdue", title: "Invoices", state: "ACTION_REQUIRED", kind: "operations", required: true, explanation: `${input.overdueInvoices} invoice${input.overdueInvoices === 1 ? " is" : "s are"} overdue.`, actionLabel: "Review", actionTo: "/finance/invoices" }));
  }
  const rank: Record<ReadinessState, number> = { BLOCKED: 0, ACTION_REQUIRED: 1, IN_PROGRESS: 2, NOT_STARTED: 3, SKIPPED: 4, COMPLETE: 5 };
  return alerts.sort((left, right) => rank[left.state] - rank[right.state]);
}
