import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { Notice, Page } from "../components/ui/Page";
import { Badge } from "../components/ui/Badge";
import { getOrganization } from "../features/admin/adminApi";
import { getOrganizationWorkspaces } from "../features/admin/workspaceApi";
import { getEffectiveEntitlements, getEntitlementLimit, type EffectiveEntitlements } from "../features/entitlements/entitlementApi";
import { getEmployees, getMe, getTeam, type Employee, type Team } from "../features/workforce/workforceApi";
import { getPayRuns, getPayrollEmployees, type PayRun } from "../features/payroll/payrollApi";
import { appPath } from "../app/hostRouting";

interface OverviewData {
  organizationStatus: string;
  entitlements: EffectiveEntitlements;
  activeWorkspaces: number | null;
  employeeCount: number | null;
  currentEmployee: Employee | null;
  team: Team | null;
  payrollEmployees: number | null;
  payRuns: PayRun[];
}

export function HomePage() {
  const auth = useAuth(), workspace = useWorkspace();
  const organization = auth.organization, selected = workspace.workspace, role = organization?.membershipRole;
  const workforceEnabled = Boolean(selected?.products.some((product) => product.key === "workforce"));
  const payrollEnabled = Boolean(selected?.products.some((product) => product.key === "payroll"));
  const [data, setData] = useState<OverviewData | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState("");

  useEffect(() => {
    setData(null); setError("");
    if (!organization || !selected) return;
    setLoading(true);
    const load = async () => {
      if (role === "ADMIN") {
        const [profile, entitlements, workspaces, workforceEmployees, payrollEmployees, payRuns] = await Promise.all([
          getOrganization(), getEffectiveEntitlements(), getOrganizationWorkspaces(),
          workforceEnabled ? getEmployees("status=ACTIVE&size=1") : Promise.resolve(null),
          payrollEnabled ? getPayrollEmployees() : Promise.resolve(null),
          payrollEnabled ? getPayRuns(0, 5) : Promise.resolve(null),
        ]);
        return { organizationStatus: profile.status, entitlements, activeWorkspaces: workspaces.filter((item) => item.status === "ACTIVE").length,
          employeeCount: workforceEmployees?.totalElements ?? null, currentEmployee: null, team: null,
          payrollEmployees: payrollEmployees?.length ?? null, payRuns: payRuns?.content ?? [] };
      }
      const currentEmployee = workforceEnabled ? await getMe() : null;
      const team = workforceEnabled && role === "MANAGER" ? await getTeam() : null;
      return { organizationStatus: organization.organizationStatus, entitlements: [], activeWorkspaces: null, employeeCount: null, currentEmployee, team, payrollEmployees: null, payRuns: [] };
    };
    void load().then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load organization overview."))
      .finally(() => setLoading(false));
  }, [organization?.slug, role, selected?.key, workforceEnabled, payrollEnabled]);

  if (auth.organizations.length === 0) return <Page title="Overview"><Notice tone="info">Your account has no active organization memberships.</Notice></Page>;
  if (!organization) return <Page title="Overview"><Notice tone="info">Choose an organization from the header to enter its Organization Console.</Notice></Page>;
  if (workspace.loading) return <Page title="Overview"><Notice tone="info">Loading available workspaces…</Notice></Page>;
  if (workspace.error) return <Page title="Overview"><Notice>{workspace.error}</Notice></Page>;
  if (workspace.workspaces.length === 0) return <Page title="Overview"><Notice tone="info">No active workspaces are available for this organization.</Notice></Page>;
  if (!selected) return <Page title="Overview"><Notice tone="info">Choose an active workspace to open its Workforce and Payroll capabilities.</Notice></Page>;
  if (error) return <Page title="Overview"><Notice>{error}</Notice></Page>;
  if (loading || !data) return <Page title="Overview"><Notice tone="info">Loading organization overview…</Notice></Page>;

  const planNames = [...new Set(data.entitlements.map((item) => item.planName))];
  const employeeLimit = getEntitlementLimit(data.entitlements, "platform.employee_limit");
  const workspaceLimit = getEntitlementLimit(data.entitlements, "platform.workspace_limit");
  const attention = role === "ADMIN" ? [
    workforceEnabled && data.employeeCount === 0 ? { text: "No active Workforce employees are configured.", to: "/app/workforce/employees" } : null,
    payrollEnabled && data.payrollEmployees === 0 ? { text: "No employees are configured for Payroll.", to: "/app/payroll/employees" } : null,
    payrollEnabled && data.payrollEmployees !== null && data.payrollEmployees > 0 && data.payRuns.length === 0 ? { text: "Payroll employees exist, but no pay runs have been created.", to: "/app/payroll/pay-runs" } : null,
  ].filter((item): item is { text: string; to: string } => item !== null) : [];
  return <Page title={organization.organizationName} description="Horizon Organization Console">
    <div className="organization-context-banner"><div><span>Current workspace</span><strong>{selected.displayName}</strong><small>{selected.key}</small></div><div><span>Organization role</span><strong>{role}</strong><small>Organization membership</small></div><div><span>Status</span><Badge label={data.organizationStatus} variant={data.organizationStatus === "ACTIVE" ? "success" : "neutral"} /></div></div>
    <div className="organization-metrics">
      {role === "ADMIN" && <Metric label="Current plan" value={planNames.join(", ") || "—"} note="Effective organization plan" />}
      {data.employeeCount !== null && <Metric label="Employees" value={usage(data.employeeCount, employeeLimit)} note="Active workspace records" />}
      {data.activeWorkspaces !== null && <Metric label="Workspaces" value={usage(data.activeWorkspaces, workspaceLimit)} note="Active organization workspaces" />}
      {data.team && <Metric label="My team" value={String(data.team.employees.length)} note="Direct reports" />}
      {data.currentEmployee && <Metric label="My profile" value={data.currentEmployee.employeeCode} note={data.currentEmployee.status} />}
      {data.payrollEmployees !== null && <Metric label="Payroll employees" value={String(data.payrollEmployees)} note="Configured in this workspace" />}
    </div>
    <section className="organization-panel"><header><div><span className="eyebrow">Workspace capabilities</span><h2>Enabled products</h2><p>Availability returned for the selected workspace.</p></div></header><div className="organization-product-grid">{selected.products.map((product) => <ProductSummary key={product.key} name={product.displayName} productKey={product.key} role={role} count={product.key === "workforce" ? data.employeeCount : product.key === "payroll" ? data.payrollEmployees : null} />)}</div></section>
    {role === "ADMIN" && <section className="organization-panel"><header><div><span className="eyebrow">Attention</span><h2>Operational readiness</h2><p>Actions derived from the current workspace data.</p></div></header>{attention.length ? <ul className="organization-attention-list">{attention.map((item) => <li key={item.to}><span>{item.text}</span><Link to={appPath(item.to)}>Review →</Link></li>)}</ul> : <div className="platform-good-state">No immediate setup gaps were found for this workspace.</div>}</section>}
    {role === "ADMIN" && payrollEnabled && <section className="organization-panel"><header><div><span className="eyebrow">Payroll operations</span><h2>Recent pay runs</h2><p>Latest runs in {selected.displayName}.</p></div><Link to={appPath("/app/payroll/pay-runs")}>Open Pay Runs →</Link></header>{data.payRuns.length ? <div className="platform-table compact"><table><thead><tr><th>Pay run</th><th>Period</th><th>Status</th><th>Employees</th><th>Net total</th></tr></thead><tbody>{data.payRuns.map((run) => <tr key={run.payRunKey}><td><strong>{run.payRunKey}</strong></td><td>{run.periodStart} – {run.periodEnd}</td><td><Badge label={run.status} /></td><td>{run.employeeCount}</td><td>{new Intl.NumberFormat(undefined, { style: "currency", currency: run.currency }).format(run.netTotal)}</td></tr>)}</tbody></table></div> : <div className="organization-empty-inline">No pay runs have been created in this workspace.</div>}</section>}
  </Page>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <article><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }
function ProductSummary({ name, productKey, role, count }: { name: string; productKey: string; role?: string; count: number | null }) {
  const route = productKey === "workforce" ? role === "ADMIN" ? "/app/workforce/dashboard" : "/app/workforce/me" : productKey === "payroll" && role === "ADMIN" ? "/app/payroll/dashboard" : null;
  return <article><div><Badge label="Enabled" variant="success" /><h3>{name}</h3>{count !== null && <p>{count} configured employee{count === 1 ? "" : "s"}</p>}</div>{route && <Link to={appPath(route)}>Open {name} →</Link>}</article>;
}
function usage(current: number, limit: number | null) { return limit === null ? String(current) : `${current} / ${limit}`; }
