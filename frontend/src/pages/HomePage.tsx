import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { Notice, Page } from "../components/ui/Page";
import { Badge } from "../components/ui/Badge";
import { getOrganization } from "../features/admin/adminApi";
import { getOrganizationWorkspaces } from "../features/admin/workspaceApi";
import { getEffectiveEntitlements, getEntitlementLimit, type EffectiveEntitlements } from "../features/entitlements/entitlementApi";
import { getDepartments, getDesignations, getEmployees, getMe, getTeam, type Employee, type Team } from "../features/workforce/workforceApi";
import { getPayRuns, getPayrollEmployees, getPayrollReadiness, type PayrollReadiness, type PayRun } from "../features/payroll/payrollApi";
import { appPath } from "../app/hostRouting";
import { Icon } from "../layout/SidebarIcon";
import { OnboardingPage } from "./onboarding/OnboardingPage";

interface OverviewData {
  organizationStatus: string;
  entitlements: EffectiveEntitlements;
  activeWorkspaces: number | null;
  employeeCount: number | null;
  workforceEmployeeCodes: string[];
  currentEmployee: Employee | null;
  team: Team | null;
  payrollEmployees: number | null;
  payrollEmployeeCodes: string[];
  payRuns: PayRun[];
  readiness: PayrollReadiness | null;
  departments: number | null;
  designations: number | null;
}

export function HomePage() {
  const auth = useAuth(), workspace = useWorkspace();
  const organization = auth.organization, selected = workspace.workspace, role = organization?.membershipRole;
  const workforceEnabled = Boolean(selected?.products.some((product) => product.key === "workforce"));
  const payrollEnabled = Boolean(selected?.products.some((product) => product.key === "payroll"));
  const [data, setData] = useState<OverviewData | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState("");

  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setData(null); setError("");
    if (!organization) return;
    setLoading(true);
    const load = async () => {
      if (role === "ADMIN") {
        const [profile, entitlements, workspaces, workforceEmployees, workforceRecords, payrollEmployees, payRuns, readiness, departments, designations] = await Promise.all([
          getOrganization(), getEffectiveEntitlements(), getOrganizationWorkspaces(),
          workforceEnabled ? getEmployees("status=ACTIVE&size=1") : Promise.resolve(null),
          workforceEnabled && payrollEnabled ? getActiveWorkforceCodes() : Promise.resolve([]),
          payrollEnabled ? getPayrollEmployees() : Promise.resolve(null),
          payrollEnabled ? getPayRuns(0, 5) : Promise.resolve(null),
          payrollEnabled ? getPayrollReadiness() : Promise.resolve(null),
          workforceEnabled ? getDepartments() : Promise.resolve(null),
          workforceEnabled ? getDesignations() : Promise.resolve(null),
        ]);
        return { organizationStatus: profile.status, entitlements, activeWorkspaces: workspaces.filter((item) => item.status === "ACTIVE").length,
          employeeCount: workforceEmployees?.totalElements ?? null, workforceEmployeeCodes: workforceRecords, currentEmployee: null, team: null,
          payrollEmployees: payrollEmployees?.length ?? null, payrollEmployeeCodes: payrollEmployees?.map((employee) => employee.employeeCode) ?? [], payRuns: payRuns?.content ?? [], readiness, departments: departments?.length ?? null, designations: designations?.length ?? null };
      }
      const currentEmployee = workforceEnabled ? await getMe() : null;
      const team = workforceEnabled && role === "MANAGER" ? await getTeam() : null;
      return { organizationStatus: organization.organizationStatus, entitlements: [], activeWorkspaces: null, employeeCount: null, workforceEmployeeCodes: [], currentEmployee, team, payrollEmployees: null, payrollEmployeeCodes: [], payRuns: [], readiness: null, departments: null, designations: null };
    };
    void load().then(value => { if (current) setData(value); }).catch((reason) => { if (current) setError(reason instanceof Error ? reason.message : "Unable to load Horizon overview."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [organization?.slug, role, selected?.key, workforceEnabled, payrollEnabled, revision]);

  if (auth.organizations.length === 0) return <Page title="Overview"><Notice tone="info">Your account has no active organization memberships. Open an invitation from your organization or ask its administrator for access.</Notice></Page>;
  if (!organization) return <Page title="Overview"><Notice tone="info">Choose an organization from the header to enter Horizon.</Notice></Page>;
  if (workspace.loading) return <Page title="Overview"><Notice tone="info">Loading available workspaces…</Notice></Page>;
  if (workspace.error) return <Page title="Overview"><Notice>{workspace.error}</Notice><button className="button secondary" onClick={() => void workspace.reload()}>Retry workspace access</button></Page>;
  if (workspace.workspaces.length === 0) {
    if (role === "ADMIN") {
      return <OnboardingPage />;
    }
    return (
      <Page title="Overview" description={organization.organizationName}>
        <Notice tone="info">
          <p>No active workspaces are available for this organization.</p>
          <p>Ask an organization administrator to provision a workspace and grant you access.</p>
        </Notice>
      </Page>
    );
  }
  if (!selected) {
    return (
      <Page
        title="Overview"
        description={`${organization.organizationName} · Choose an active workspace`}
        actions={
          role === "ADMIN" ? (
            <Link to={appPath("/organization/workspaces")} className="button secondary sm">
              Manage workspaces
            </Link>
          ) : undefined
        }
      >
        <Notice tone="info">Choose an active workspace to open its Workforce and Payroll capabilities.</Notice>
        <div className="organization-panel workspace-selection-panel">
          <header>
            <div>
              <span className="eyebrow">Workspaces</span>
              <h2>Available workspaces</h2>
              <p>Select a workspace to open its operational dashboard, workforce records, and payroll operations.</p>
            </div>
          </header>
          <div className="workspace-card-grid">
            {workspace.workspaces.map((ws) => (
              <article key={ws.key} className="workspace-choice-card">
                <div className="workspace-choice-header">
                  <div>
                    <h3 className="workspace-choice-title">{ws.displayName}</h3>
                    <span className="workspace-choice-key">{ws.key}</span>
                  </div>
                  <Badge label={ws.status} variant={ws.status === "ACTIVE" ? "success" : "neutral"} />
                </div>
                <div className="workspace-choice-products">
                  {ws.products.map((p) => (
                    <span key={p.key} className="workspace-product-tag">
                      {p.displayName}
                    </span>
                  ))}
                </div>
                <div className="workspace-choice-action">
                  <button
                    type="button"
                    className="button primary sm"
                    onClick={() => workspace.selectWorkspace(ws.key)}
                  >
                    Open workspace →
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </Page>
    );
  }
  if (error) return <Page title="Overview"><Notice>{error}</Notice><button className="button secondary" onClick={() => setRevision(value => value + 1)}>Retry overview</button></Page>;
  if (loading || !data) return <Page title="Overview"><Notice tone="info">Loading organization overview…</Notice></Page>;

  const planNames = [...new Set(data.entitlements.map((item) => item.planName))];
  const employeeLimit = getEntitlementLimit(data.entitlements, "platform.employee_limit");
  const workspaceLimit = getEntitlementLimit(data.entitlements, "platform.workspace_limit");
  const payrollEmployeeCodes = new Set(data.payrollEmployeeCodes);
  const unconfiguredPayrollCode = data.workforceEmployeeCodes.find((code) => !payrollEmployeeCodes.has(code));
  const attention = role === "ADMIN" ? [
    workforceEnabled && data.employeeCount === 0 ? { text: "No active Workforce employees are configured.", to: "/app/workforce/employees" } : null,
    payrollEnabled && data.payrollEmployees === 0 ? { text: "No employees are configured for Payroll.", to: "/app/payroll/employees" } : null,
    workforceEnabled && payrollEnabled && unconfiguredPayrollCode ? { text: "Some active Workforce employees are not configured for Payroll.", to: `/app/payroll/employees?employee=${encodeURIComponent(unconfiguredPayrollCode)}` } : null,
    payrollEnabled && data.payrollEmployees !== null && data.payrollEmployees > 0 && data.payRuns.length === 0 ? { text: "Payroll employees exist, but no pay runs have been created.", to: "/app/payroll/pay-runs" } : null,
    ...data.payRuns.filter(r => r.status === "FAILED").map(r => ({ text: `Pay run ${r.payRunKey} failed: ${r.failureMessage || "Review failure and recover."}`, to: `/app/payroll/pay-runs?run=${encodeURIComponent(r.payRunKey)}` })),
  ].filter((item): item is { text: string; to: string } => item !== null) : [];

  const userName = `${auth.user?.firstName ?? ""} ${auth.user?.lastName ?? ""}`.trim() || auth.user?.email;

  return <Page title={organization.organizationName} description="Your workspace setup and next payroll actions." actions={<button className="button secondary" onClick={() => setRevision(value => value + 1)}>Refresh overview</button>}>
    <div className="overview-welcome-card">
      <div className="overview-welcome-main">
        <h2>Welcome back, {auth.user?.firstName || userName || "Administrator"}</h2>
        <p className="overview-welcome-subtitle">
          Workspace <strong>{selected.displayName}</strong> is active. Here is your operational overview for <strong>{organization.organizationName}</strong>.
        </p>
      </div>
      <div className="overview-welcome-meta">
        <span className="overview-context-tag">
          <Icon name="building" />
          <span>{organization.organizationName}</span>
        </span>
        <span className="overview-context-tag">
          <Icon name="panels" />
          <span>{selected.displayName} ({selected.key})</span>
        </span>
        <span className="overview-context-tag">
          <Icon name="shield" />
          <span>{role}</span>
        </span>
      </div>
    </div>

    <div className="organization-context-banner horizon-context-banner">
      <div>
        <span>Current workspace</span>
        <strong>{selected.displayName}</strong>
        <small>{selected.key} · {selected.status}</small>
      </div>
      <div>
        <span>Organization role</span>
        <strong>{role}</strong>
        <small>Organization membership · {data.organizationStatus}</small>
      </div>
      <div>
        <span>Signed in as</span>
        <strong>{userName}</strong>
        <small>{auth.user?.email}</small>
      </div>
    </div>

    <div className="home-quick-actions" aria-label="Quick operations">
      <span className="quick-actions-label">Quick actions:</span>
      {workforceEnabled && (
        <Link to={appPath("/app/workforce/employees")} className="quick-action-chip">
          <Icon name="profile" />
          <span>Manage employees</span>
        </Link>
      )}
      {workforceEnabled && (
        <Link to={appPath("/app/workforce/departments")} className="quick-action-chip">
          <Icon name="workforce" />
          <span>Departments</span>
        </Link>
      )}
      {payrollEnabled && (
        <Link to={appPath("/app/payroll/pay-runs")} className="quick-action-chip">
          <Icon name="payroll" />
          <span>Pay runs</span>
        </Link>
      )}
      {payrollEnabled && (
        <Link to={appPath("/app/payroll/compensation")} className="quick-action-chip">
          <Icon name="card" />
          <span>Compensation</span>
        </Link>
      )}
      {role === "ADMIN" && (
        <Link to={appPath("/organization")} className="quick-action-chip">
          <Icon name="building" />
          <span>Organization</span>
        </Link>
      )}
      {role === "ADMIN" && (
        <Link to={appPath("/organization/members")} className="quick-action-chip">
          <Icon name="profile" />
          <span>Members</span>
        </Link>
      )}
      {role === "ADMIN" && (
        <Link to={appPath("/organization/workspaces")} className="quick-action-chip">
          <Icon name="panels" />
          <span>Workspaces</span>
        </Link>
      )}
      {role === "ADMIN" && (
        <Link to={appPath("/organization/invitations")} className="quick-action-chip">
          <Icon name="admin" />
          <span>Invite member</span>
        </Link>
      )}
    </div>

    <div className="organization-metrics">
      {role === "ADMIN" && <Metric label="Current plan" value={planNames.join(", ") || "—"} note="Effective organization plan" />}
      {data.employeeCount !== null && <Metric label="Employees" value={usage(data.employeeCount, employeeLimit)} note="Active workspace records" />}
      {role === "ADMIN" && data.departments !== null && <Metric label="Departments" value={String(data.departments)} note="Active departments" />}
      {role === "ADMIN" && data.designations !== null && <Metric label="Designations" value={String(data.designations)} note="Configured job titles" />}
      {data.activeWorkspaces !== null && <Metric label="Workspaces" value={usage(data.activeWorkspaces, workspaceLimit)} note="Active organization workspaces" />}
      {data.team && <Metric label="My team" value={String(data.team.employees.length)} note="Direct reports" />}
      {data.currentEmployee && <Metric label="My profile" value={data.currentEmployee.employeeCode} note={data.currentEmployee.status} />}
      {data.readiness && <Metric label="Compensation configured" value={`${data.readiness.employeesWithCompensation} / ${data.readiness.activeEmployees}`} note="Active employees with a compensation profile" />}
      {data.payrollEmployees !== null && <Metric label="Payroll employees" value={String(data.payrollEmployees)} note="Configured in this workspace" />}
    </div>

    {attention.length > 0 && (
      <section className="organization-panel attention-panel">
        <header>
          <div>
            <span className="eyebrow">Action items</span>
            <h2>Operational attention</h2>
            <p>Outstanding tasks and configuration gaps identified in {selected.displayName}.</p>
          </div>
        </header>
        <ul className="organization-attention-list">
          {attention.map(item => (
            <li key={item.to}>
              <span>{item.text}</span>
              <Link to={appPath(item.to)}>Review →</Link>
            </li>
          ))}
        </ul>
      </section>
    )}

    {role === "ADMIN" && payrollEnabled && <PayrollNext readiness={data.readiness!} runs={data.payRuns} />}

    <section className="organization-panel">
      <header>
        <div>
          <span className="eyebrow">Workspace capabilities</span>
          <h2>Enabled products</h2>
          <p>Availability returned for the selected workspace.</p>
        </div>
      </header>
      <div className="organization-product-grid">
        {selected.products.map((product) => (
          <ProductSummary
            key={product.key}
            name={product.displayName}
            productKey={product.key}
            role={role}
            count={product.key === "workforce" ? data.employeeCount : product.key === "payroll" ? data.payrollEmployees : null}
          />
        ))}
      </div>
    </section>

    {workforceEnabled && (
      <section className="organization-panel workforce-shortcuts-panel">
        <header>
          <div>
            <span className="eyebrow">Workforce shortcuts</span>
            <h2>Workforce management</h2>
            <p>Direct navigation to directory, organizational structure, and departmental hierarchy.</p>
          </div>
          {role === "ADMIN" && <Link to={appPath("/app/workforce/dashboard")}>Open Workforce dashboard →</Link>}
        </header>
        <div className="workforce-shortcuts-grid">
          <Link to={appPath("/app/workforce/employees")} className="workforce-shortcut-card">
            <div className="workforce-shortcut-icon"><Icon name="profile" /></div>
            <strong>Employee directory</strong>
            <span>{data.employeeCount !== null ? `${data.employeeCount} active record${data.employeeCount === 1 ? "" : "s"}` : "Manage employee profiles"}</span>
          </Link>
          <Link to={appPath("/app/workforce/departments")} className="workforce-shortcut-card">
            <div className="workforce-shortcut-icon"><Icon name="workforce" /></div>
            <strong>Departments</strong>
            <span>{data.departments !== null ? `${data.departments} active department${data.departments === 1 ? "" : "s"}` : "Organize teams and divisions"}</span>
          </Link>
          <Link to={appPath("/app/workforce/designations")} className="workforce-shortcut-card">
            <div className="workforce-shortcut-icon"><Icon name="badge" /></div>
            <strong>Job designations</strong>
            <span>{data.designations !== null ? `${data.designations} defined title${data.designations === 1 ? "" : "s"}` : "Standardize roles and titles"}</span>
          </Link>
          <Link to={appPath("/app/workforce/structure")} className="workforce-shortcut-card">
            <div className="workforce-shortcut-icon"><Icon name="panels" /></div>
            <strong>Reporting structure</strong>
            <span>Organizational hierarchy</span>
          </Link>
        </div>
      </section>
    )}

    {role === "ADMIN" && <>
      <section className="organization-panel setup-panel">
        <header className="setup-panel-header">
          <div>
            <span className="eyebrow">Get ready</span>
            <h2>Workspace setup</h2>
            <p>Configure the people you intend to pay. Optional organization details can be added later.</p>
          </div>
          <button
            type="button"
            className="button secondary sm setup-toggle-btn"
            onClick={() => {
              const el = document.getElementById("horizon-setup-steps");
              if (el) el.hidden = !el.hidden;
            }}
          >
            Toggle checklist
          </button>
        </header>
        <div id="horizon-setup-steps">
          <ol className="horizon-setup-list">
            <SetupStep title="Organization details" detail={`Review the organization profile and regional settings before onboarding people. Current status: ${data.organizationStatus}.`} to="/organization" action="Review organization" />
            <SetupStep title="Workspace and plan" detail={`${data.activeWorkspaces ?? 0} active workspace${data.activeWorkspaces === 1 ? "" : "s"}. Workspace capabilities come from the assigned organization plan.`} to="/organization/workspaces" action="Manage workspace" />
            {workforceEnabled && <>
              <SetupStep title="Departments and designations" detail={`${data.departments} departments · ${data.designations} designations. Optional: organize employees by team and job title.`} to="/app/workforce/departments" action="Configure organization details" />
              <SetupStep title="Employees" detail={`${data.employeeCount} active employees. A Workforce employee must exist before payroll enrollment.`} to="/app/workforce/employees" action="Manage employees" />
              <SetupStep title="Reporting structure" detail="Optional: assign managers from employee profiles. The server prevents reporting cycles." to="/app/workforce/structure" action="Review reporting structure" />
            </>}
            {payrollEnabled && <>
              <SetupStep title="Payroll employees" detail={`${data.readiness?.activeEmployees ?? 0} active payroll employees. Configure currency, pay frequency and eligibility date.`} to={unconfiguredPayrollCode ? `/app/payroll/employees?employee=${encodeURIComponent(unconfiguredPayrollCode)}` : "/app/payroll/employees"} action="Configure payroll employees" />
              <SetupStep title="Compensation" detail={`${data.readiness?.employeesWithCompensation ?? 0} active payroll employees have an active profile with components. Effective dates and frequency must match the chosen pay period.`} to={data.readiness?.nextEmployeeCode ? `/app/payroll/compensation?employee=${encodeURIComponent(data.readiness.nextEmployeeCode)}` : "/app/payroll/compensation"} action="Review compensation" />
            </>}
          </ol>
        </div>
        {!workforceEnabled && !payrollEnabled && <Notice tone="info">No business capabilities are available. <Link to={appPath("/organization/workspaces")}>Review workspace products and access</Link>.</Notice>}
      </section>
    </>}
    {role === "ADMIN" && payrollEnabled && (
      <section className="organization-panel">
        <header>
          <div>
            <span className="eyebrow">Payroll operations</span>
            <h2>Recent pay runs</h2>
            <p>Latest five runs in {selected.displayName}.</p>
          </div>
          <Link to={appPath("/app/payroll/pay-runs")}>Open Pay Runs →</Link>
        </header>
        {data.payRuns.length ? (
          <div className="platform-table compact">
            <table>
              <thead>
                <tr>
                  <th>Pay run</th>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Employees</th>
                  <th>Net total</th>
                </tr>
              </thead>
              <tbody>
                {data.payRuns.map((run) => (
                  <tr key={run.payRunKey}>
                    <td>
                      <strong>{run.payRunKey}</strong>
                      <br />
                      <Link to={`${appPath("/app/payroll/pay-runs")}?run=${encodeURIComponent(run.payRunKey)}`}>
                        Open pay run
                      </Link>
                    </td>
                    <td>{run.periodStart} – {run.periodEnd}</td>
                    <td><Badge label={run.status} /></td>
                    <td>{run.employeeCount}</td>
                    <td>{new Intl.NumberFormat(undefined, { style: "currency", currency: run.currency }).format(run.netTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="organization-empty-inline">No pay runs have been created in this workspace.</div>
        )}
      </section>
    )}
  </Page>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <article><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }
function ProductSummary({ name, productKey, role, count }: { name: string; productKey: string; role?: string; count: number | null }) {
  const route = productKey === "workforce" ? role === "ADMIN" ? "/app/workforce/dashboard" : "/app/workforce/me" : productKey === "payroll" && role === "ADMIN" ? "/app/payroll/dashboard" : null;
  return <article><div><Badge label="Enabled" variant="success" /><h3>{name}</h3>{count !== null && <p>{count} configured employee{count === 1 ? "" : "s"}</p>}</div>{route && <Link to={appPath(route)}>Open {name} →</Link>}</article>;
}
function usage(current: number, limit: number | null) { return limit === null ? String(current) : `${current} / ${limit}`; }
async function getActiveWorkforceCodes(): Promise<string[]> {
  const first = await getEmployees("status=ACTIVE&size=100");
  const codes = first.content.map((employee) => employee.employeeCode);
  for (let page = 1; page < first.totalPages; page++) {
    const next = await getEmployees(`status=ACTIVE&page=${page}&size=100`);
    codes.push(...next.content.map((employee) => employee.employeeCode));
  }
  return codes;
}

function SetupStep({ title, detail, to, action }: { title: string; detail: string; to: string; action: string }) {
  return <li><div><h3>{title}</h3><p>{detail}</p></div><Link to={appPath(to)}>{action} →</Link></li>;
}
export function FirstRunChecklist({ organizationStatus, hasPlan }: { organizationStatus: string; hasPlan: boolean }) {
  return <section className="organization-panel setup-panel" aria-labelledby="first-run-checklist">
    <header className="setup-panel-header">
      <div>
        <span className="eyebrow">First-run setup</span>
        <h2 id="first-run-checklist">Get your organization ready</h2>
        <p>Resume setup at any time. Each step opens the existing workflow and preserves server-side authorization and plan rules.</p>
      </div>
    </header>
    <ol className="horizon-setup-list">
      <SetupStep title="Organization details" detail={`Review organization profile, regional defaults and branding. Current status: ${organizationStatus}.`} to="/organization" action="Review organization" />
      <li>
        <div><h3>Assign a plan and create a workspace</h3><p>{hasPlan ? "An active plan is assigned. Create a workspace to unlock Workforce and Payroll setup." : "No active plan is assigned. A Horizon platform administrator must assign Starter or Business before workspace creation."}</p></div>
        <Link to={appPath("/organization/workspaces")}>{hasPlan ? "Create workspace" : "Review plan"} →</Link>
      </li>
      <SetupStep title="Departments and designations" detail="Available after a workspace is created. Use the workspace step above first." to="/organization/workspaces" action="Create workspace first" />
      <SetupStep title="Employees" detail="Available after a workspace is created. Add active people before configuring payroll enrollment." to="/organization/workspaces" action="Create workspace first" />
      <SetupStep title="Compensation and payroll readiness" detail="Available after a workspace is created. Enroll payroll employees, add effective compensation profiles, then create and finalize a pay run." to="/organization/workspaces" action="Create workspace first" />
    </ol>
  </section>;
}
function PayrollNext({ readiness, runs }: { readiness: PayrollReadiness; runs: PayRun[] }) {
  const run = runs.find(item => item.status !== "FINALIZED");
  const latestResult = runs.find(item => item.status === "FINALIZED");
  let heading = "Choose a payroll period", detail = "Create a pay run with dates matching your employees’ pay frequency. Processing calculates all included employees; previewing an individual calculation is optional.", action = "Create a pay run", to = "/app/payroll/pay-runs";
  if (run) {
    heading = `${run.payRunKey} · ${run.status}`;
    detail = run.status === "DRAFT" ? "Include employees, check their compensation and period, then process this draft." : run.status === "CALCULATED" ? "Review the calculated totals before finalizing. Finalization creates immutable ledger entries and payslips." : run.status === "FAILED" ? (run.failureMessage || "Review the failure, correct setup and recover this run to draft.") : "Refresh the run to check processing or review its recovery options.";
    action = run.status === "FAILED" ? "Review failed run" : run.status === "CALCULATED" ? "Review and finalize" : "Continue pay run";
    to += `?run=${encodeURIComponent(run.payRunKey)}`;
  } else if (readiness.activeEmployees === 0) {
    heading = "Configure an employee for payroll"; detail = "Payroll needs an active employee with a currency, pay frequency and eligibility date."; action = "Configure payroll employees"; to = "/app/payroll/employees";
  } else if (readiness.nextEmployeeCode) {
    heading = `Add compensation for ${readiness.nextEmployeeCode}`; detail = "An active compensation profile with components is required to calculate this employee’s pay."; action = "Set up compensation"; to = `/app/payroll/compensation?employee=${encodeURIComponent(readiness.nextEmployeeCode)}`;
  }
  return <section className="organization-panel"><header><div><span className="eyebrow">Next payroll action</span><h2>{heading}</h2><p>{detail}</p></div><Link className="button primary" to={appPath(to)}>{action}</Link></header>
    <p className="snapshot-note">Configuration counts are not a pay-period approval. Calculation validates effective dates, frequency and compensation eligibility for each included employee.</p>
    {latestResult && <p>Recent finalized result: <Link to={`${appPath("/app/payroll/pay-runs")}?run=${encodeURIComponent(latestResult.payRunKey)}`}>{latestResult.payRunKey}</Link> · {new Intl.NumberFormat(undefined, { style: "currency", currency: latestResult.currency }).format(latestResult.netTotal)} net · {latestResult.periodStart} – {latestResult.periodEnd}</p>}
  </section>;
}
