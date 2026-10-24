import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { Notice, Page } from "../components/ui/Page";
import { Badge, StatusBadge } from "../components/ui/Badge";
import { formatMoney, formatPeriod, humanize, personName } from "../lib/format";
import { getInvitations, getOrganization, type Organization } from "../features/admin/adminApi";
import { getOrganizationWorkspaces } from "../features/admin/workspaceApi";
import { deriveProductKeysFromEntitlements, getEffectiveEntitlements, getEntitlementLimit, type EffectiveEntitlements } from "../features/entitlements/entitlementApi";
import { getBillingSummary, type BillingSummary } from "../features/finance/financeApi";
import { nextPayrollAction, operationalAttention, readinessLabel, workspaceChecklist, type ReadinessItem } from "../features/readiness/readiness";
import { getDepartments, getDesignations, getEmployees, getMe, getTeam, type Employee, type Team } from "../features/workforce/workforceApi";
import { getPayRuns, getPayrollEmployees, getPayrollReadiness, type PayrollReadiness, type PayRun } from "../features/payroll/payrollApi";
import { appPath } from "../app/hostRouting";
import { Icon } from "../layout/SidebarIcon";
import { OnboardingPage } from "./onboarding/OnboardingPage";

interface OverviewData {
  organizationProfile: Organization | null;
  organizationStatus: string;
  invitations: { status: string }[];
  billing: BillingSummary | null;
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
  const financeEnabled = Boolean(selected?.products.some((product) => product.key === "finance"));
  const [data, setData] = useState<OverviewData | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const checklistStorageKey = `lexorion.setup-checklist.${organization?.slug ?? "none"}`;
  const [checklistOpen, setChecklistOpen] = useState(true);
  useEffect(() => { try { setChecklistOpen(localStorage.getItem(checklistStorageKey) !== "closed"); } catch { setChecklistOpen(true); } }, [checklistStorageKey]);

  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setData(null); setError("");
    if (!organization) return;
    setLoading(true);
    const load = async () => {
      if (role === "ADMIN") {
        const [profile, entitlements, workspaces, workforceEmployees, workforceRecords, payrollEmployees, payRuns, readiness, departments, designations, invitations, billing] = await Promise.all([
          getOrganization(), getEffectiveEntitlements(), getOrganizationWorkspaces(),
          workforceEnabled ? getEmployees("status=ACTIVE&size=1") : Promise.resolve(null),
          workforceEnabled ? getActiveWorkforceEmployees() : Promise.resolve([]),
          payrollEnabled ? getPayrollEmployees() : Promise.resolve(null),
          payrollEnabled ? getPayRuns(0, 5) : Promise.resolve(null),
          payrollEnabled ? getPayrollReadiness() : Promise.resolve(null),
          workforceEnabled ? getDepartments() : Promise.resolve(null),
          workforceEnabled ? getDesignations() : Promise.resolve(null),
          getInvitations().catch(() => []),
          financeEnabled ? getBillingSummary().catch(() => null) : Promise.resolve(null),
        ]);
        return { organizationProfile: profile, organizationStatus: profile.status, invitations, billing, entitlements, activeWorkspaces: workspaces.filter((item) => item.status === "ACTIVE").length,
          employeeCount: workforceEmployees?.totalElements ?? null, workforceEmployeeCodes: workforceRecords.map((employee) => employee.employeeCode),
          workforceNames: Object.fromEntries(workforceRecords.map((employee) => [employee.employeeCode.toUpperCase(), personName(employee)])), currentEmployee: null, team: null,
          payrollEmployees: payrollEmployees?.length ?? null, payrollEmployeeCodes: payrollEmployees?.map((employee) => employee.employeeCode) ?? [], payRuns: payRuns?.content ?? [], readiness, departments: departments?.length ?? null, designations: designations?.length ?? null };
      }
      const currentEmployee = workforceEnabled ? await getMe() : null;
      const team = workforceEnabled && role === "MANAGER" ? await getTeam() : null;
      return { organizationProfile: null, organizationStatus: organization.organizationStatus, invitations: [], billing: null, entitlements: [], activeWorkspaces: null, employeeCount: null, workforceEmployeeCodes: [], workforceNames: {}, currentEmployee, team, payrollEmployees: null, payrollEmployeeCodes: [], payRuns: [], readiness: null, departments: null, designations: null };
    };
    void load().then(value => { if (current) setData(value); }).catch((reason) => { if (current) setError(reason instanceof Error ? reason.message : "Unable to load Horizon overview."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [organization?.slug, role, selected?.key, workforceEnabled, payrollEnabled, financeEnabled, revision]);

  if (auth.organizations.length === 0) return <Page title="Dashboard"><Notice tone="info">Your account has no active organization memberships. Open an invitation from your organization or ask its administrator for access.</Notice></Page>;
  if (!organization) return <Page title="Dashboard"><Notice tone="info">Choose an organization from the header to enter Horizon.</Notice></Page>;
  if (workspace.loading) return <Page title="Dashboard"><Notice tone="info">Loading available workspaces…</Notice></Page>;
  if (workspace.error) return <Page title="Dashboard"><Notice>{workspace.error}</Notice><button className="button secondary" onClick={() => void workspace.reload()}>Retry workspace access</button></Page>;
  if (workspace.workspaces.length === 0) {
    if (role === "ADMIN") {
      return <OnboardingPage />;
    }
    return (
      <Page title="Dashboard" description={organization.organizationName}>
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
        title="Dashboard"
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
  if (error) return <Page title="Dashboard"><Notice>{error}</Notice><button className="button secondary" onClick={() => setRevision(value => value + 1)}>Retry</button></Page>;
  if (loading || !data) return <Page title="Dashboard"><Notice tone="info">Loading the dashboard…</Notice></Page>;

  const planNames = [...new Set(data.entitlements.map((item) => item.planName))];
  const employeeLimit = getEntitlementLimit(data.entitlements, "platform.employee_limit");
  const workspaceLimit = getEntitlementLimit(data.entitlements, "platform.workspace_limit");
  const payrollEmployeeCodes = new Set(data.payrollEmployeeCodes.map((code) => code.toUpperCase()));
  const unconfiguredPayrollCode = data.workforceEmployeeCodes.find((code) => !payrollEmployeeCodes.has(code.toUpperCase())) ?? null;
  const payrollAction = payrollEnabled && data.readiness ? nextPayrollAction({ readiness: data.readiness, runs: data.payRuns, names: data.workforceNames, guided: workforceEnabled }) : null;
  const overviewInput = {
    organization: data.organizationProfile, workspaces: workspace.workspaces, requiredProductKeys: deriveProductKeysFromEntitlements(data.entitlements),
    invitations: data.invitations, workforceEnabled, payrollEnabled, financeEnabled,
    employeeCount: data.employeeCount, departmentCount: data.departments, activePayrollEmployees: data.readiness?.activeEmployees ?? 0,
    employeesWithCompensation: data.readiness?.employeesWithCompensation ?? 0, nextEmployeeCode: data.readiness?.nextEmployeeCode ?? null,
    unenrolledEmployeeCode: unconfiguredPayrollCode, runs: data.payRuns, statutoryDecisionsOpen: data.readiness?.statutoryDecisionsOpen ?? 0,
    detailsAwaitingVerification: data.readiness?.detailsAwaitingVerification ?? 0, pendingInvitationCount: data.invitations.filter((invitation) => invitation.status === "PENDING").length,
    overdueInvoices: data.billing?.overdueInvoices ?? null, activeClients: data.billing?.activeClients ?? null,
  };
  const attention = role === "ADMIN" ? operationalAttention(overviewInput, payrollAction?.featuredKey ?? null) : [];
  const checklist = role === "ADMIN" ? workspaceChecklist(overviewInput) : [];

  const userName = `${auth.user?.firstName ?? ""} ${auth.user?.lastName ?? ""}`.trim() || auth.user?.email;

  return <Page title="Dashboard" description={`${organization.organizationName} · Your workspace setup and next payroll actions.`} actions={<button className="button secondary" onClick={() => setRevision(value => value + 1)}>Refresh</button>}>
    <div className="overview-welcome-card">
      <div className="overview-welcome-main">
        <h2>Welcome back, {auth.user?.firstName || userName || "Administrator"}</h2>
        <p className="overview-welcome-subtitle">
          Workspace <strong>{selected.displayName}</strong> is active. This is the dashboard for <strong>{organization.organizationName}</strong>.
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
          <span>{humanize(role)}</span>
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
        <strong>{humanize(role)}</strong>
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
        <Link to={appPath("/workforce/employees")} className="quick-action-chip">
          <Icon name="profile" />
          <span>Manage employees</span>
        </Link>
      )}
      {workforceEnabled && (
        <Link to={appPath("/workforce/departments")} className="quick-action-chip">
          <Icon name="workforce" />
          <span>Departments</span>
        </Link>
      )}
      {payrollEnabled && (
        <Link to={appPath("/payroll/runs")} className="quick-action-chip">
          <Icon name="payroll" />
          <span>Pay runs</span>
        </Link>
      )}
      {payrollEnabled && (
        <Link to={appPath("/payroll/compensation")} className="quick-action-chip">
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
        <Link to={appPath("/people")} className="quick-action-chip">
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
            <li key={item.key}>
              <span>{item.explanation}</span>
              {item.actionTo && <Link to={appPath(item.actionTo)}>{item.actionLabel ?? "Review"} →</Link>}
            </li>
          ))}
        </ul>
      </section>
    )}

    {role === "ADMIN" && payrollEnabled && payrollAction && <PayrollNext action={payrollAction} runs={data.payRuns} />}

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
            <p>Direct navigation to employee directory, departments, and designations.</p>
          </div>
          {role === "ADMIN" && <Link to={appPath("/workforce/employees")}>Open employees →</Link>}
        </header>
        <div className="workforce-shortcuts-grid">
          <Link to={appPath("/workforce/employees")} className="workforce-shortcut-card">
            <div className="workforce-shortcut-icon"><Icon name="profile" /></div>
            <strong>Employee directory</strong>
            <span>{data.employeeCount !== null ? `${data.employeeCount} active record${data.employeeCount === 1 ? "" : "s"}` : "Manage employee profiles"}</span>
          </Link>
          <Link to={appPath("/workforce/departments")} className="workforce-shortcut-card">
            <div className="workforce-shortcut-icon"><Icon name="workforce" /></div>
            <strong>Departments</strong>
            <span>{data.departments !== null ? `${data.departments} active department${data.departments === 1 ? "" : "s"}` : "Organize teams and divisions"}</span>
          </Link>
          <Link to={appPath("/workforce/designations")} className="workforce-shortcut-card">
            <div className="workforce-shortcut-icon"><Icon name="badge" /></div>
            <strong>Job designations</strong>
            <span>{data.designations !== null ? `${data.designations} defined title${data.designations === 1 ? "" : "s"}` : "Standardize roles and titles"}</span>
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
            aria-expanded={checklistOpen}
            onClick={() => setChecklistOpen((open) => {
              const next = !open;
              try { localStorage.setItem(checklistStorageKey, next ? "open" : "closed"); } catch { /* Preference storage may be unavailable. */ }
              return next;
            })}
          >
            {checklistOpen ? "Hide checklist" : "Show checklist"}
          </button>
        </header>
        {checklistOpen && <div id="horizon-setup-steps">
          <ol className="horizon-setup-list">
            {checklist.map((entry) => <SetupStep key={entry.key} item={entry} />)}
          </ol>
        </div>}
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
          <Link to={appPath("/payroll/runs")}>Open Pay Runs →</Link>
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
                      <Link to={`${appPath("/payroll/runs")}?run=${encodeURIComponent(run.payRunKey)}`}>
                        Open pay run
                      </Link>
                    </td>
                    <td>{formatPeriod(run.periodStart, run.periodEnd)}</td>
                    <td><StatusBadge status={run.status} /></td>
                    <td>{run.employeeCount}</td>
                    <td>{formatMoney(run.netTotal, run.currency)}</td>
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
  const route = productKey === "workforce" ? role === "ADMIN" ? "/workforce/employees" : "/workforce/me" : productKey === "payroll" && role === "ADMIN" ? "/payroll/runs" : null;
  return <article><div><Badge label="Enabled" variant="success" /><h3>{name}</h3>{count !== null && <p>{count} configured employee{count === 1 ? "" : "s"}</p>}</div>{route && <Link to={appPath(route)}>Open {name} →</Link>}</article>;
}
function usage(current: number, limit: number | null) { return limit === null ? String(current) : `${current} / ${limit}`; }
async function getActiveWorkforceEmployees(): Promise<Employee[]> {
  const first = await getEmployees("status=ACTIVE&size=100");
  const employees = [...first.content];
  for (let page = 1; page < first.totalPages; page++) employees.push(...(await getEmployees(`status=ACTIVE&page=${page}&size=100`)).content);
  return employees;
}

function SetupStep({ item }: { item: ReadinessItem }) {
  const tone = item.state === "COMPLETE" ? "success" : item.state === "BLOCKED" || item.state === "ACTION_REQUIRED" ? "warning" : "neutral";
  return <li><div><h3>{item.title} <span className={`badge ${tone}`}>{readinessLabel(item)}</span></h3><p>{item.explanation}</p></div>{item.actionTo && item.state !== "COMPLETE" && <Link to={appPath(item.actionTo)}>{item.actionLabel} →</Link>}</li>;
}
function PayrollNext({ action, runs }: { action: { heading: string; detail: string; action: string; to: string }; runs: PayRun[] }) {
  const latestResult = runs.find(item => item.status === "FINALIZED");
  return <section className="organization-panel"><header><div><span className="eyebrow">Next payroll action</span><h2>{action.heading}</h2><p>{action.detail}</p></div><Link className="button primary" to={appPath(action.to)}>{action.action}</Link></header>
    <p className="snapshot-note">Configuration counts are not a pay-period approval. Calculation validates effective dates, frequency and compensation eligibility for each included employee.</p>
    {latestResult && <p>Recent finalized result, not a payment: <Link to={`${appPath("/payroll/runs")}?run=${encodeURIComponent(latestResult.payRunKey)}`}>{latestResult.payRunKey}</Link> · {formatMoney(latestResult.netTotal, latestResult.currency)} calculated net · {formatPeriod(latestResult.periodStart, latestResult.periodEnd)}</p>}
  </section>;
}
