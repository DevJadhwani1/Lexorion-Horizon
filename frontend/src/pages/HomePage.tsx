import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { Notice, Page } from "../components/ui/Page";
import { Badge, StatusBadge } from "../components/ui/Badge";
import { formatMoney, formatPeriod, humanize, personName } from "../lib/format";
import { getOrganization } from "../features/admin/adminApi";
import { getOrganizationWorkspaces } from "../features/admin/workspaceApi";
import { getEffectiveEntitlements, getEntitlementLimit, type EffectiveEntitlements } from "../features/entitlements/entitlementApi";
import { getDepartments, getDesignations, getEmployees, getMe, getTeam, type Employee, type Team } from "../features/workforce/workforceApi";
import { getPayRuns, getPayrollEmployees, getPayrollReadiness, type PayrollReadiness, type PayRun } from "../features/payroll/payrollApi";
import { appPath } from "../app/hostRouting";

interface OverviewData {
  organizationStatus: string;
  entitlements: EffectiveEntitlements;
  activeWorkspaces: number | null;
  employeeCount: number | null;
  workforceEmployeeCodes: string[];
  workforceNames: Record<string, string>;
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
    if (!organization || !selected) return;
    setLoading(true);
    const load = async () => {
      if (role === "ADMIN") {
        const [profile, entitlements, workspaces, workforceEmployees, workforceRecords, payrollEmployees, payRuns, readiness, departments, designations] = await Promise.all([
          getOrganization(), getEffectiveEntitlements(), getOrganizationWorkspaces(),
          workforceEnabled ? getEmployees("status=ACTIVE&size=1") : Promise.resolve(null),
          workforceEnabled ? getActiveWorkforceEmployees() : Promise.resolve([]),
          payrollEnabled ? getPayrollEmployees() : Promise.resolve(null),
          payrollEnabled ? getPayRuns(0, 5) : Promise.resolve(null),
          payrollEnabled ? getPayrollReadiness() : Promise.resolve(null),
          workforceEnabled ? getDepartments() : Promise.resolve(null),
          workforceEnabled ? getDesignations() : Promise.resolve(null),
        ]);
        return { organizationStatus: profile.status, entitlements, activeWorkspaces: workspaces.filter((item) => item.status === "ACTIVE").length,
          employeeCount: workforceEmployees?.totalElements ?? null, workforceEmployeeCodes: workforceRecords.map((employee) => employee.employeeCode),
          workforceNames: Object.fromEntries(workforceRecords.map((employee) => [employee.employeeCode.toUpperCase(), personName(employee)])), currentEmployee: null, team: null,
          payrollEmployees: payrollEmployees?.length ?? null, payrollEmployeeCodes: payrollEmployees?.map((employee) => employee.employeeCode) ?? [], payRuns: payRuns?.content ?? [], readiness, departments: departments?.length ?? null, designations: designations?.length ?? null };
      }
      const currentEmployee = workforceEnabled ? await getMe() : null;
      const team = workforceEnabled && role === "MANAGER" ? await getTeam() : null;
      return { organizationStatus: organization.organizationStatus, entitlements: [], activeWorkspaces: null, employeeCount: null, workforceEmployeeCodes: [], workforceNames: {}, currentEmployee, team, payrollEmployees: null, payrollEmployeeCodes: [], payRuns: [], readiness: null, departments: null, designations: null };
    };
    void load().then(value => { if (current) setData(value); }).catch((reason) => { if (current) setError(reason instanceof Error ? reason.message : "Unable to load Horizon overview."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [organization?.slug, role, selected?.key, workforceEnabled, payrollEnabled, revision]);

  if (auth.organizations.length === 0) return <Page title="Overview"><Notice tone="info">Your account has no active organization memberships. Open an invitation from your organization or ask its administrator for access.</Notice></Page>;
  if (!organization) return <Page title="Overview"><Notice tone="info">Choose an organization from the header to enter Horizon.</Notice></Page>;
  if (workspace.loading) return <Page title="Overview"><Notice tone="info">Loading available workspaces…</Notice></Page>;
  if (workspace.error) return <Page title="Overview"><Notice>{workspace.error}</Notice><button className="button secondary" onClick={() => void workspace.reload()}>Retry workspace access</button></Page>;
  if (workspace.workspaces.length === 0) return <Page title="Overview" description={organization.organizationName}>
    <Notice tone="info">
      <p>No active workspaces are available for this organization.</p>
      {role === "ADMIN"
        ? <Link className="button primary" to={appPath("/app/admin/workspaces")}>Set up a workspace</Link>
        : <p>Ask an organization administrator to provision a workspace and grant you access.</p>}
    </Notice>
  </Page>;
  if (!selected) return <Page title="Overview"><Notice tone="info">Choose an active workspace to open its Workforce and Payroll capabilities.</Notice></Page>;
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
  ].filter((item): item is { text: string; to: string } => item !== null) : [];
  return <Page title={organization.organizationName} description="Your workspace setup and next payroll actions." actions={<button className="button secondary" onClick={() => setRevision(value => value + 1)}>Refresh overview</button>}>
    <div className="organization-context-banner horizon-context-banner"><div><span>Current workspace</span><strong>{selected.displayName}</strong><small>{selected.key}</small></div><div><span>Organization role</span><strong>{humanize(role)}</strong><small>Organization membership · {data.organizationStatus}</small></div><div><span>Signed in as</span><strong>{`${auth.user?.firstName ?? ""} ${auth.user?.lastName ?? ""}`.trim() || auth.user?.email}</strong><small>{auth.user?.email}</small></div></div>
    <div className="organization-metrics">
      {role === "ADMIN" && <Metric label="Current plan" value={planNames.join(", ") || "—"} note="Effective organization plan" />}
      {data.employeeCount !== null && <Metric label="Employees" value={usage(data.employeeCount, employeeLimit)} note="Active workspace records" />}
      {data.activeWorkspaces !== null && <Metric label="Workspaces" value={usage(data.activeWorkspaces, workspaceLimit)} note="Active organization workspaces" />}
      {data.team && <Metric label="My team" value={String(data.team.employees.length)} note="Direct reports" />}
      {data.currentEmployee && <Metric label="My profile" value={data.currentEmployee.employeeCode} note={data.currentEmployee.status} />}
      {data.readiness && <Metric label="Compensation configured" value={`${data.readiness.employeesWithCompensation} / ${data.readiness.activeEmployees}`} note="Active employees with a compensation profile" />}
      {data.payrollEmployees !== null && <Metric label="Payroll employees" value={String(data.payrollEmployees)} note="Configured in this workspace" />}
    </div>
    {role === "ADMIN" && payrollEnabled && <PayrollNext readiness={data.readiness!} runs={data.payRuns} names={data.workforceNames} guided={workforceEnabled} />}
    <section className="organization-panel"><header><div><span className="eyebrow">Workspace capabilities</span><h2>Enabled products</h2><p>Availability returned for the selected workspace.</p></div></header><div className="organization-product-grid">{selected.products.map((product) => <ProductSummary key={product.key} name={product.displayName} productKey={product.key} role={role} count={product.key === "workforce" ? data.employeeCount : product.key === "payroll" ? data.payrollEmployees : null} />)}</div></section>
    {role === "ADMIN" && <>
      <section className="organization-panel"><header><div><span className="eyebrow">Get ready</span><h2>Workspace setup</h2><p>Configure the people you intend to pay. Optional organization details can be added later.</p></div></header>
        <ol className="horizon-setup-list">
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
        {!workforceEnabled && !payrollEnabled && <Notice tone="info">No business capabilities are available. <Link to={appPath("/app/admin/workspaces")}>Review workspace products and access</Link>.</Notice>}
        {attention.length > 0 && <ul className="organization-attention-list">{attention.map(item => <li key={item.to}><span>{item.text}</span><Link to={appPath(item.to)}>Review →</Link></li>)}</ul>}
      </section>
    </>}
    {role === "ADMIN" && payrollEnabled && <section className="organization-panel"><header><div><span className="eyebrow">Payroll operations</span><h2>Recent pay runs</h2><p>Latest five runs in {selected.displayName}.</p></div><Link to={appPath("/app/payroll/pay-runs")}>Open Pay Runs →</Link></header>{data.payRuns.length ? <div className="platform-table compact"><table><thead><tr><th>Pay run</th><th>Period</th><th>Status</th><th>Employees</th><th>Net total</th></tr></thead><tbody>{data.payRuns.map((run) => <tr key={run.payRunKey}><td><strong>{run.payRunKey}</strong><br /><Link to={`${appPath("/app/payroll/pay-runs")}?run=${encodeURIComponent(run.payRunKey)}`}>Open pay run</Link></td><td>{formatPeriod(run.periodStart, run.periodEnd)}</td><td><StatusBadge status={run.status} /></td><td>{run.employeeCount}</td><td>{formatMoney(run.netTotal, run.currency)}</td></tr>)}</tbody></table></div> : <div className="organization-empty-inline">No pay runs have been created in this workspace.</div>}</section>}
  </Page>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <article><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }
function ProductSummary({ name, productKey, role, count }: { name: string; productKey: string; role?: string; count: number | null }) {
  const route = productKey === "workforce" ? role === "ADMIN" ? "/app/workforce/employees" : "/app/workforce/me" : productKey === "payroll" && role === "ADMIN" ? "/app/payroll/pay-runs" : null;
  return <article><div><Badge label="Enabled" variant="success" /><h3>{name}</h3>{count !== null && <p>{count} configured employee{count === 1 ? "" : "s"}</p>}</div>{route && <Link to={appPath(route)}>Open {name} →</Link>}</article>;
}
function usage(current: number, limit: number | null) { return limit === null ? String(current) : `${current} / ${limit}`; }
async function getActiveWorkforceEmployees(): Promise<Employee[]> {
  const first = await getEmployees("status=ACTIVE&size=100");
  const employees = [...first.content];
  for (let page = 1; page < first.totalPages; page++) employees.push(...(await getEmployees(`status=ACTIVE&page=${page}&size=100`)).content);
  return employees;
}

function SetupStep({ title, detail, to, action }: { title: string; detail: string; to: string; action: string }) {
  return <li><div><h3>{title}</h3><p>{detail}</p></div><Link to={appPath(to)}>{action} →</Link></li>;
}
function PayrollNext({ readiness, runs, names, guided }: { readiness: PayrollReadiness; runs: PayRun[]; names: Record<string, string>; guided: boolean }) {
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
    const code = readiness.nextEmployeeCode;
    heading = `Add a salary for ${names[code.toUpperCase()] ?? code}`; detail = "This employee is set up for payroll but has no salary yet, so they cannot be paid."; action = "Set up compensation";
    // The guided setup resumes at the salary step for an enrolled employee; without Workforce, use Compensation directly.
    to = guided ? `/app/workforce/employees/new?employee=${encodeURIComponent(code)}` : `/app/payroll/compensation?employee=${encodeURIComponent(code)}`;
  }
  return <section className="organization-panel"><header><div><span className="eyebrow">Next payroll action</span><h2>{heading}</h2><p>{detail}</p></div><Link className="button primary" to={appPath(to)}>{action}</Link></header>
    <p className="snapshot-note">Configuration counts are not a pay-period approval. Calculation validates effective dates, frequency and compensation eligibility for each included employee.</p>
    {latestResult && <p>Recent finalized result: <Link to={`${appPath("/app/payroll/pay-runs")}?run=${encodeURIComponent(latestResult.payRunKey)}`}>{latestResult.payRunKey}</Link> · {formatMoney(latestResult.netTotal, latestResult.currency)} net · {formatPeriod(latestResult.periodStart, latestResult.periodEnd)}</p>}
  </section>;
}
