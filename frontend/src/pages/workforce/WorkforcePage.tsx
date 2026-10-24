import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ApiError, type Page as ResultPage } from "../../api/types";
import {
  createDepartment,
  createDesignation,
  getDepartments,
  getDesignations,
  getEmployee,
  exitEmployee,
  getEmployeeHistory,
  getEmployees,
  getMe,
  getTeam,
  mapEmployeeUser,
  rehireEmployee,
  transitionEmployee,
  updateEmployee,
  updateDepartment,
  updateDesignation,
  type Employee,
  type EmployeeHistory,
  type EmploymentStatus,
  type Reference,
  type Team,
} from "../../features/workforce/workforceApi";
import { useWorkforceDirectory } from "../../features/workforce/useWorkforceDirectory";
import { getOwnPayslips, getPayrollEmployee, getPayrollEmployees, getPayrollReadiness, getProfiles, type Payslip } from "../../features/payroll/payrollApi";
import { StatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Empty, Notice, Page } from "../../components/ui/Page";
import { Field } from "../../components/ui/Field";
import { Dropdown } from "../../components/ui/Dropdown";
import { Table } from "../admin/AdminPage";
import { useAuth } from "../../auth/AuthProvider";
import { appPath } from "../../app/hostRouting";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { formatDate, humanize, keyFromName, personName } from "../../lib/format";
import { EMPLOYMENT_TYPES, EmployeeFields } from "./EmployeeFields";
import { workflowLink } from "../../components/HorizonWorkflowNav";
import { useConfirm } from "../../components/ui/ConfirmDialog";
import { DepartmentsPage } from "./DepartmentsPage";

export function WorkforcePage({ sectionKey }: { sectionKey?: string }) {
  const { section: routeSection, employeeCode } = useParams(),
    section = sectionKey ?? routeSection ?? "employees",
    [data, setData] = useState<unknown>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const organization = useAuth().organization, workspace = useWorkspace().workspace;
  const listSection = !employeeCode && (section === "employees" || section === "dashboard");
  const load = async () => {
    if (listSection) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      setData(
        await (employeeCode
          ? getEmployee(employeeCode)
          : section === "departments"
            ? getDepartments()
            : section === "designations"
              ? getDesignations()
              : section === "team"
                ? getTeam()
                : getMe()),
      );
    } catch (x) {
      setError(x instanceof ApiError ? x.message : "Unable to load Workforce");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [section, employeeCode, organization?.organizationId, workspace?.key]);
  if (listSection) return <EmployeeDirectory />;
  if (loading) return <Page title="Workforce"><p>Loading…</p></Page>;
  if (error) return <Page title="Workforce"><Notice>{error}</Notice></Page>;
  if (employeeCode) return <EmployeeProfile employee={data as Employee} reload={load} />;
  if (section === "departments")
    return <DepartmentsPage items={data as Reference[]} reload={load} />;
  if (section === "designations")
    return <References title={section} items={data as Reference[]} reload={load} />;
  if (section === "me") return <EmployeeProfile employee={data as Employee} reload={load} self />;
  return <TeamPage team={data as Team} />;
}

function TeamPage({ team }: { team: Team }) {
  const directory = useWorkforceDirectory();
  return <Page title="My team" description="People who report directly to you.">
    {team.employees.length ? (
      <Table headers={["Employee", "Department", "Designation", "Status"]}>
        {team.employees.map((e) => (
          <tr key={e.employeeCode}>
            <td><Link to={appPath(`/workforce/employees/${e.employeeCode}`)}>{e.name}</Link><small className="cell-note">{e.employeeCode}</small></td>
            <td>{directory.departmentName(e.departmentKey)}</td>
            <td>{directory.designationName(e.designationKey)}</td>
            <td><StatusBadge status={e.status} /></td>
          </tr>
        ))}
      </Table>
    ) : (
      <Empty>No one reports to you yet. Reporting managers are assigned on each employee’s profile.</Empty>
    )}
  </Page>;
}

const statuses: EmploymentStatus[] = ["ACTIVE", "ON_LEAVE", "SUSPENDED", "RESIGNED", "TERMINATED"];
const sorts = [["firstName", "First name"], ["lastName", "Last name"], ["employeeCode", "Employee code"], ["joiningDate", "Joining date"]] as const;
const PAGE_SIZE = 20;

/** Employee list backed by the Workforce API's search, filter, sort and pagination parameters. */
function EmployeeDirectory() {
  const [params, setParams] = useSearchParams();
  const directory = useWorkforceDirectory();
  const workspace = useWorkspace().workspace;
  const payrollOn = Boolean(workspace?.products.some((product) => product.key === "payroll"));
  const search = params.get("q") ?? "", status = params.get("status") ?? "", department = params.get("department") ?? "",
    designation = params.get("designation") ?? "", group = params.get("group") ?? "", view = params.get("view") ?? "",
    sort = params.get("sort") ?? "firstName", direction = params.get("direction") === "DESC" ? "DESC" : "ASC",
    page = Math.max(0, Number(params.get("page")) || 0);
  const [draft, setDraft] = useState(search);
  const [result, setResult] = useState<ResultPage<Employee> | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const [payrollCodes, setPayrollCodes] = useState<Set<string> | null>(null);
  const [gaps, setGaps] = useState<{ employeeCode: string; reason: string; href: string }[]>([]);
  const update = (changes: Record<string, string>) => setParams((previous) => {
    const next = new URLSearchParams(previous);
    for (const [key, value] of Object.entries(changes)) if (value) next.set(key, value); else next.delete(key);
    if (!("page" in changes)) next.delete("page");
    return next;
  }, { replace: true });
  useEffect(() => { setDraft(search); }, [search]);
  useEffect(() => {
    if (draft === search) return;
    const timer = window.setTimeout(() => update({ q: draft.trim() }), 300);
    return () => window.clearTimeout(timer);
  }, [draft]);
  useEffect(() => {
    let current = true;
    const query = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE), sort, direction });
    if (search) query.set("search", search);
    if (status && view !== "unenrolled" && view !== "setup") query.set("status", status);
    if (group && view !== "unenrolled" && view !== "setup") query.set("group", group);
    if (department) query.set("departmentKey", department);
    if (designation) query.set("designationKey", designation);
    setLoading(true); setError("");
    getEmployees(query.toString())
      .then((value) => { if (current) setResult(value); })
      .catch((reason) => { if (current) setError(reason instanceof ApiError ? reason.message : "Unable to load employees"); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [search, status, department, designation, group, view, sort, direction, page]);
  useEffect(() => {
    if (!payrollOn || (view !== "unenrolled" && view !== "setup")) return;
    let current = true;
    const loadPayroll = view === "unenrolled"
      ? getPayrollEmployees().then((rows) => { if (current) setPayrollCodes(new Set(rows.map((row) => row.employeeCode))); })
      : getPayrollReadiness().then((value) => { if (current) setGaps(value.gaps ?? []); });
    loadPayroll.catch(() => { if (current) setError("Unable to load payroll setup"); });
    return () => { current = false; };
  }, [payrollOn, view]);
  const filtered = Boolean(search || status || department || designation || group || view);
  const applyView = (nextView: string) => {
    if (nextView === "active") update({ view: nextView, status: "ACTIVE", group: "" });
    else if (nextView === "leave") update({ view: nextView, status: "ON_LEAVE", group: "" });
    else if (nextView === "exited") update({ view: nextView, status: "", group: "EXITED" });
    else if (nextView === "contract") update({ view: nextView, status: "", group: "CONTRACT" });
    else if (nextView === "unenrolled" || nextView === "setup") update({ view: nextView, status: "", group: "" });
    else update({ view: "", status: "", group: "" });
  };
  const employees = (view === "unenrolled" && payrollCodes ? (result?.content ?? []).filter((person) => !payrollCodes.has(person.employeeCode)) : result?.content ?? []);
  const gapLabel: Record<string, string> = { INACTIVE_EMPLOYMENT: "Inactive for payroll", MISSING_COMPENSATION: "Salary missing" };
  return (
    <Page title="Employees" description="Everyone in this workspace. Open an employee to update their details, status or payroll setup."
      actions={<Link className="button primary" to={appPath("/workforce/employees/new")}>Add employee</Link>}>
      <div className="toolbar" role="group" aria-label="Employee views">
        {([["", "All"], ["active", "Active"], ["leave", "On leave"], ["exited", "Exited"], ["contract", "Contractors"], ...(payrollOn ? [["unenrolled", "Payroll not enrolled"], ["setup", "Setup incomplete"]] as const : [])] as const).map(([value, label]) => (
          <Button key={label} type="button" size="sm" variant={view === value ? "primary" : "secondary"} aria-pressed={view === value} onClick={() => applyView(value)}>{label}</Button>
        ))}
      </div>
      <form className="toolbar filter-bar directory-filters" role="search" onSubmit={(event) => { event.preventDefault(); update({ q: draft.trim() }); }}>
        <label>Search employees<input type="search" placeholder="Name, email or employee code" value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
        <Dropdown label="Status" value={status} onChange={(next) => update({ status: next, view: "", group: "" })}
          options={[{ value: "", label: "All statuses" }, ...statuses.map((value) => ({ value, label: humanize(value) }))]} />
        {directory.departments.length > 0 && <Dropdown label="Department" value={department} onChange={(next) => update({ department: next })}
          options={[{ value: "", label: "All departments" }, ...directory.departments.map((item) => ({ value: item.key, label: item.name }))]} />}
        {directory.designations.length > 0 && <Dropdown label="Designation" value={designation} onChange={(next) => update({ designation: next })}
          options={[{ value: "", label: "All designations" }, ...directory.designations.map((item) => ({ value: item.key, label: item.name }))]} />}
        <Dropdown label="Sort by" value={`${sort}:${direction}`} onChange={(next) => { const [field, order] = next.split(":"); update({ sort: field, direction: order }); }}
          options={sorts.flatMap(([field, text]) => [
            { value: `${field}:ASC`, label: `${text} ${field === "joiningDate" ? "(oldest first)" : "(A–Z)"}` },
            { value: `${field}:DESC`, label: `${text} ${field === "joiningDate" ? "(newest first)" : "(Z–A)"}` },
          ])} />
        {filtered && <Button type="button" onClick={() => { setDraft(""); setParams(new URLSearchParams({ sort, direction }), { replace: true }); }}>Clear filters</Button>}
      </form>
      {error && <Notice>{error}</Notice>}
      {view === "setup" ? (gaps.length ? <Table headers={["Employee", "What is missing", ""]}>{gaps.filter((gap) => !search || gap.employeeCode.toLowerCase().includes(search.toLowerCase())).map((gap) => <tr key={gap.employeeCode}><td><Link to={appPath(`/workforce/employees/${gap.employeeCode}`)}>{gap.employeeCode}</Link></td><td>{gapLabel[gap.reason] ?? gap.reason}</td><td><Link to={workflowLink(appPath(gap.href), `${appPath("/workforce/employees")}?view=setup${search ? `&q=${encodeURIComponent(search)}` : ""}`)}>Fix</Link></td></tr>)}</Table> : <Empty>Everyone enrolled in payroll has an active salary.</Empty>) : null}
      {view !== "setup" && (loading && !result ? <p role="status">Loading employees…</p> : employees.length ? <>
        <Table headers={["Employee", "Email", "Department", "Designation", "Joined", "Status"]}>
          {employees.map((e) => (
            <tr key={e.employeeCode}>
              <td><Link to={appPath(`/workforce/employees/${e.employeeCode}`)}>{personName(e)}</Link><small className="cell-note">{e.employeeCode}</small></td>
              <td>{e.workEmail}</td>
              <td>{directory.departmentName(e.departmentKey)}</td>
              <td>{directory.designationName(e.designationKey)}</td>
              <td>{formatDate(e.joiningDate)}</td>
              <td><StatusBadge status={e.status} /></td>
            </tr>
          ))}
        </Table>
        <Pagination page={page} totalPages={result?.totalPages ?? 1} total={result?.totalElements ?? employees.length} size={PAGE_SIZE} busy={loading} onPage={(next) => update({ page: next ? String(next) : "" })} />
      </> : filtered
        ? <Empty>No employees match these filters. <button type="button" className="link-button" onClick={() => { setDraft(""); setParams(new URLSearchParams(), { replace: true }); }}>Clear filters</button></Empty>
        : <Empty><strong>No employees yet.</strong><br />Add your first employee to start building your team and payroll. <Link to={appPath("/workforce/employees/new")}>Add employee</Link></Empty>)}
    </Page>
  );
}

export function Pagination({ page, totalPages, total, size, busy, onPage }: { page: number; totalPages: number; total: number; size: number; busy?: boolean; onPage(page: number): void }) {
  if (total === 0) return null;
  const first = page * size + 1, last = Math.min(total, (page + 1) * size);
  return <nav className="pagination" aria-label="Pagination">
    <span>Showing {first}–{last} of {total}</span>
    {totalPages > 1 && <>
      <Button size="sm" disabled={busy || page === 0} onClick={() => onPage(page - 1)}>Previous</Button>
      <span>Page {page + 1} of {totalPages}</span>
      <Button size="sm" disabled={busy || page + 1 >= totalPages} onClick={() => onPage(page + 1)}>Next</Button>
    </>}
  </nav>;
}

const transitionLabels: Record<string, string> = { leave: "Mark on leave", suspend: "Suspend", resign: "Record resignation", terminate: "Terminate", activate: "Reactivate" };
const transitions: Record<EmploymentStatus, string[]> = {
  ACTIVE: ["leave", "suspend", "resign", "terminate"],
  ON_LEAVE: ["activate", "terminate"],
  SUSPENDED: ["activate", "resign", "terminate"],
  RESIGNED: ["terminate"],
  TERMINATED: [],
};

function EmployeeProfile({ employee, reload, self = false }: { employee: Employee; reload(): Promise<void>; self?: boolean }) {
  const auth = useAuth(),
    admin = auth.organization?.membershipRole === "ADMIN",
    workspace = useWorkspace().workspace;
  const directory = useWorkforceDirectory();
  const payrollEnabled = admin && !self && Boolean(workspace?.products.some((product) => product.key === "payroll"));
  const [error, setError] = useState(""), [saved, setSaved] = useState(""),
    [history, setHistory] = useState<EmployeeHistory>({ events: [], spells: [] }),
    [historyLoading, setHistoryLoading] = useState(admin && !self),
    [editing, setEditing] = useState(false), [busy, setBusy] = useState(false),
    [exitAction, setExitAction] = useState<"resign" | "terminate" | null>(null),
    [rehireOpen, setRehireOpen] = useState(false),
    [payslips, setPayslips] = useState<Payslip[] | null>(null),
    [openPayslip, setOpenPayslip] = useState<Payslip | null>(null);
  useEffect(() => {
    if (!admin || self) return;
    setHistoryLoading(true);
    getEmployeeHistory(employee.employeeCode)
      .then((value) => setHistory(value ?? { events: [], spells: [] }))
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Unable to load employee history"))
      .finally(() => setHistoryLoading(false));
  }, [admin, employee.employeeCode, self, employee.status]);
  useEffect(() => {
    if (!self) return;
    let current = true;
    getOwnPayslips()
      .then((rows) => { if (current) setPayslips(rows); })
      .catch((reason) => { if (current) setError(reason instanceof ApiError ? reason.message : "Unable to load payslips"); });
    return () => { current = false; };
  }, [self]);
  const [ask, confirmDialog] = useConfirm();
  const name = personName(employee);
  const manager = employee.reportingManagerEmployeeCode;
  return (
    <Page title={name} description={`${employee.employeeCode} · ${employee.workEmail}`}
      actions={admin && !self && !editing ? <Button onClick={() => { setEditing(true); setSaved(""); }}>Edit details</Button> : undefined}>
      {confirmDialog}
      {error && <Notice>{error}</Notice>}
      {saved && <Notice tone="success">{saved}</Notice>}
      {editing ? <form className="card employee-form" aria-label="Edit employee" onSubmit={(event: FormEvent) => {
        event.preventDefault();
        setError(""); setBusy(true);
        const form = new FormData(event.currentTarget as HTMLFormElement);
        const values: Record<string, unknown> = Object.fromEntries(form.entries());
        // Optional fields are cleared explicitly so the PATCH removes a previous value.
        for (const key of ["middleName", "phone", "employmentType", "departmentKey", "designationKey", "reportingManagerEmployeeCode"]) if (values[key] === "") values[key] = null;
        if (values.phone === null) values.phoneCountry = null;
        void updateEmployee(employee.employeeCode, values)
          .then(async () => { setEditing(false); setSaved("Employee details saved."); await reload(); })
          .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Unable to update employee"))
          .finally(() => setBusy(false));
      }}>
        <EmployeeFields employee={employee} departments={directory.departments} designations={directory.designations} managers={directory.employees} />
        <div className="form-actions">
          <Button variant="primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
          <Button type="button" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </form> : <div className="cards">
        <article>
          <h3>Employment</h3>
          <dl className="detail-list">
            <div><dt>Status</dt><dd><StatusBadge status={employee.status} /></dd></div>
            <div><dt>Original hire date</dt><dd>{formatDate(employee.originalJoiningDate || employee.joiningDate)}</dd></div>
            <div><dt>Current spell started</dt><dd>{formatDate(employee.joiningDate)}</dd></div>
            <div><dt>Phone</dt><dd>{employee.phone || "—"}</dd></div>
            <div><dt>Employment type</dt><dd>{employee.employmentType ? humanize(employee.employmentType) : "—"}</dd></div>
          </dl>
        </article>
        <article>
          <h3>Organization</h3>
          <dl className="detail-list">
            <div><dt>Department</dt><dd>{directory.departmentName(employee.departmentKey)}</dd></div>
            <div><dt>Designation</dt><dd>{directory.designationName(employee.designationKey)}</dd></div>
            <div><dt>Reporting manager</dt><dd>{manager ? (admin ? <Link to={appPath(`/workforce/employees/${manager}`)}>{directory.nameOf(manager)}</Link> : directory.nameOf(manager)) : "—"}</dd></div>
          </dl>
        </article>
        {payrollEnabled && <PayrollSetupCard employeeCode={employee.employeeCode} />}
      </div>}
      {admin && !self && !editing && (
        <>
          {(transitions[employee.status].length > 0 || employee.status === "RESIGNED" || employee.status === "TERMINATED") && <section className="card" aria-labelledby="employee-status-heading">
            <h3 id="employee-status-heading">Employment status</h3>
            <div className="toolbar">
              {transitions[employee.status].filter((action) => action !== "resign" && action !== "terminate").map((action) => (
                <Button key={action} variant="secondary" disabled={busy}
                  onClick={async () => {
                    if (!(await ask({ title: `${transitionLabels[action]} for ${name}?`, confirmLabel: transitionLabels[action], body: "This is recorded in the employee’s history." }))) return;
                    setBusy(true); setError("");
                    void transitionEmployee(employee.employeeCode, action)
                      .then(async () => { setSaved(`${transitionLabels[action]}: done.`); await reload(); })
                      .catch((x) => setError(x instanceof ApiError ? x.message : "Unable to change status"))
                      .finally(() => setBusy(false));
                  }}>
                  {transitionLabels[action] ?? humanize(action)}
                </Button>
              ))}
              {transitions[employee.status].includes("resign") && <Button type="button" disabled={busy} onClick={() => setExitAction("resign")}>Record resignation</Button>}
              {transitions[employee.status].includes("terminate") && <Button type="button" variant="destructive" disabled={busy} onClick={() => setExitAction("terminate")}>Terminate</Button>}
              {(employee.status === "RESIGNED" || employee.status === "TERMINATED") && <Button type="button" variant="primary" disabled={busy} onClick={() => setRehireOpen(true)}>Rehire</Button>}
            </div>
            {exitAction && <form className="card" aria-label="Exit employment" onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const exitDate = String(form.get("exitDate") ?? ""), exitReason = String(form.get("exitReason") ?? "").trim();
              if (!exitDate || !exitReason) { setError("Exit date and reason are required."); return; }
              if (!(await ask({ title: `${transitionLabels[exitAction]} for ${name}?`, confirmLabel: transitionLabels[exitAction], tone: "destructive", body: "The current employment spell closes. Finalized payslips stay unchanged, and the employee code is kept." }))) return;
              setBusy(true); setError("");
              void exitEmployee(employee.employeeCode, exitAction, { exitDate, exitReason })
                .then(async () => { setExitAction(null); setSaved("Employment spell closed. Finalized payslips are unchanged."); await reload(); })
                .catch((x) => setError(x instanceof ApiError ? x.message : "Unable to close employment"))
                .finally(() => setBusy(false));
            }}>
              <Field label="Exit date"><input name="exitDate" type="date" required defaultValue={employee.joiningDate} /></Field>
              <Field label="Exit reason"><input name="exitReason" required maxLength={500} /></Field>
              <div className="form-actions">
                <Button variant="destructive" disabled={busy}>{busy ? "Saving…" : transitionLabels[exitAction]}</Button>
                <Button type="button" onClick={() => setExitAction(null)}>Cancel</Button>
              </div>
            </form>}
            {rehireOpen && <form className="card" aria-label="Rehire employee" onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const joiningDate = String(form.get("joiningDate") ?? "");
              if (!joiningDate) { setError("Joining date is required."); return; }
              if (!(await ask({ title: `Rehire ${name}?`, confirmLabel: "Rehire", body: "This opens a new employment spell on the same employee record. Previous spells and finalized payslips stay unchanged. Salary and statutory setup are not copied forward." }))) return;
              setBusy(true); setError("");
              void rehireEmployee(employee.employeeCode, {
                joiningDate,
                employmentType: String(form.get("employmentType") ?? "") || null,
                departmentKey: String(form.get("departmentKey") ?? "") || null,
                designationKey: String(form.get("designationKey") ?? "") || null,
                reportingManagerEmployeeCode: String(form.get("reportingManagerEmployeeCode") ?? "") || null,
              }).then(async () => { setRehireOpen(false); setSaved("Rehired. Previous employment and finalized payslips are unchanged."); await reload(); })
                .catch((x) => setError(x instanceof ApiError ? x.message : "Unable to rehire"))
                .finally(() => setBusy(false));
            }}>
              <p className="snapshot-note">Previous spells and finalized payslips remain unchanged. Confirm the new spell, then set up payroll again.</p>
              <Field label="Joining date"><input name="joiningDate" type="date" required /></Field>
              <Dropdown label="Employment type" name="employmentType" defaultValue="FULL_TIME" options={EMPLOYMENT_TYPES} />
              <Dropdown label="Department" name="departmentKey" defaultValue="" options={[{ value: "", label: "No department" }, ...directory.departments.filter((item) => item.status === "ACTIVE").map((item) => ({ value: item.key, label: item.name }))]} />
              <Dropdown label="Designation" name="designationKey" defaultValue="" options={[{ value: "", label: "No designation" }, ...directory.designations.filter((item) => item.status === "ACTIVE").map((item) => ({ value: item.key, label: item.name }))]} />
              <Dropdown label="Reporting manager" name="reportingManagerEmployeeCode" defaultValue="" options={[{ value: "", label: "No manager" }, ...directory.employees.filter((item) => item.employeeCode !== employee.employeeCode && item.status === "ACTIVE").map((item) => ({ value: item.employeeCode, label: personName(item) }))]} />
              <div className="form-actions">
                <Button variant="primary" disabled={busy}>{busy ? "Saving…" : "Rehire"}</Button>
                <Button type="button" onClick={() => setRehireOpen(false)}>Cancel</Button>
              </div>
            </form>}
          </section>}
          <section className="card" aria-labelledby="employee-portal-heading">
            <h3 id="employee-portal-heading">Employee portal access</h3>
            <p className="snapshot-note">Link this employee to their Horizon sign-in so they can see their own profile. The person must already be a member of this organization.</p>
            <form className="toolbar" onSubmit={(e: FormEvent) => {
              e.preventDefault();
              const email = String(new FormData(e.currentTarget as HTMLFormElement).get("email"));
              setError("");
              void mapEmployeeUser(employee.employeeCode, email)
                .then(async () => { setSaved(`Linked to ${email}.`); await reload(); })
                .catch((x) => setError(x instanceof ApiError ? x.message : "Unable to link user"));
            }}>
              <label>Member email<input name="email" type="email" required defaultValue={employee.workEmail} /></label>
              <Button>Link user</Button>
            </form>
          </section>
          <section className="card" aria-labelledby="employee-history-heading">
            <h3 id="employee-history-heading">Employment history</h3>
            {historyLoading ? <p>Loading history…</p> : <>
              {history.spells.length ? <ol className="spell-timeline">{history.spells.map((spell) => <li key={spell.spellNumber}><strong>Spell {spell.spellNumber}</strong> · {humanize(spell.status)} · {formatDate(spell.joiningDate)}{spell.exitDate ? ` to ${formatDate(spell.exitDate)}` : ""}{spell.exitReason ? ` · ${spell.exitReason}` : ""}</li>)}</ol> : null}
              {history.events.length ? (
              <Table headers={["Change", "From", "To", "Date"]}>
                {history.events.map((event) => <tr key={`${event.occurredAt}:${event.action}`}>
                  <td>{humanize(event.action)}</td>
                  <td>{event.previousStatus ? humanize(event.previousStatus) : "—"}</td>
                  <td>{humanize(event.newStatus)}</td>
                  <td>{new Date(event.occurredAt).toLocaleString()}</td>
                </tr>)}
              </Table>
            ) : <Empty>No status changes yet.</Empty>}
            </>}
          </section>
        </>
      )}
      {self && <section className="card" aria-labelledby="own-payslips-heading">
        <h3 id="own-payslips-heading">Payslips</h3>
        {payslips === null && !error ? <p role="status">Loading payslips…</p> : payslips?.length ? <ul>{payslips.map((slip) => <li key={slip.payRunKey}><button type="button" className="link-button" onClick={() => setOpenPayslip(slip)}>{formatDate(slip.periodStart)} – {formatDate(slip.periodEnd)}</button> · Finalized</li>)}</ul> : <Empty>No finalized payslip yet. A payslip appears here after payroll is finalized. Finalizing does not send a payment.</Empty>}
        {openPayslip && <>
          <Button type="button" onClick={() => window.print()}>Print</Button>
          <article className="payslip-sheet" aria-label={`Payslip ${openPayslip.payRunKey}`}>
            <h4>{formatDate(openPayslip.periodStart)} – {formatDate(openPayslip.periodEnd)}</h4>
            <p>Finalized calculation. This is not confirmation that money was sent.</p>
            <ul>
              {openPayslip.earnings.map((line) => <li key={`earn-${line.componentKey}`}>{line.displayName} {line.amount} {openPayslip.currency}</li>)}
              {openPayslip.deductions.map((line) => <li key={`deduct-${line.componentKey}`}>{line.displayName} {line.amount} {openPayslip.currency}</li>)}
            </ul>
            <p>Gross {openPayslip.grossAmount} {openPayslip.currency} · Deductions {openPayslip.deductionAmount} {openPayslip.currency} · Net {openPayslip.netAmount} {openPayslip.currency}</p>
          </article>
        </>}
      </section>}
    </Page>
  );
}

/** Shows whether this person can be paid yet and links into the guided setup at the right step. */
function PayrollSetupCard({ employeeCode }: { employeeCode: string }) {
  const [state, setState] = useState<"loading" | "missing" | "no-compensation" | "ready" | "error">("loading");
  useEffect(() => {
    let current = true;
    getPayrollEmployee(employeeCode, { expectMissing: true })
      .then(() => getProfiles(employeeCode))
      .then((profiles) => { if (current) setState(profiles.some((profile) => profile.status === "ACTIVE" && profile.components.length > 0) ? "ready" : "no-compensation"); })
      .catch((reason) => { if (current) setState(reason instanceof ApiError && reason.status === 404 ? "missing" : "error"); });
    return () => { current = false; };
  }, [employeeCode]);
  const back = appPath(`/workforce/employees/${employeeCode}`);
  const setup = workflowLink(`${appPath("/workforce/employees/new")}?employee=${encodeURIComponent(employeeCode)}`, back);
  const compensation = workflowLink(`${appPath("/payroll/compensation")}?employee=${encodeURIComponent(employeeCode)}`, back);
  return <article>
    <h3>Payroll</h3>
    {state === "loading" && <p>Checking payroll setup…</p>}
    {state === "error" && <p>Payroll setup could not be checked. <Link to={compensation}>Open compensation</Link></p>}
    {state === "missing" && <><p>Not set up for payroll yet.</p><Link className="button primary" to={setup}>Set up payroll</Link></>}
    {state === "no-compensation" && <><p>Enrolled in payroll, but no salary has been set.</p><Link className="button primary" to={compensation}>Add salary</Link></>}
    {state === "ready" && <><p><StatusBadge status="ACTIVE" /> Set up for payroll.</p><Link to={compensation}>View compensation</Link></>}
  </article>;
}

function References({ title, items, reload }: { title: "departments" | "designations"; items: Reference[]; reload(): Promise<void> }) {
  const create = title === "departments" ? createDepartment : createDesignation,
    update = title === "departments" ? updateDepartment : updateDesignation;
  const singular = title === "departments" ? "department" : "designation";
  const [error, setError] = useState(""), [name, setName] = useState(""), [key, setKey] = useState(""), [keyEdited, setKeyEdited] = useState(false);
  const names = new Map(items.map((item) => [item.key, item.name]));
  return (
    <Page title={humanize(title)} description={title === "departments"
      ? "Group employees into teams. Departments are optional and can be nested under a parent."
      : "Job titles you can assign to employees. Designations are optional."}>
      <form className="card form-grid" aria-label={`Add ${singular}`}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          const body = Object.fromEntries(Array.from(new FormData(e.currentTarget as HTMLFormElement).entries()).filter(([, value]) => value !== ""));
          setError("");
          void create(body).then(async () => { setName(""); setKey(""); setKeyEdited(false); await reload(); }).catch((reason) =>
            setError(reason instanceof ApiError ? reason.message : `Unable to create ${singular}`),
          );
        }}>
        <label>Name<input name="name" required value={name} onChange={(event) => { setName(event.target.value); if (!keyEdited) setKey(keyFromName(event.target.value)); }} placeholder={title === "departments" ? "e.g. Engineering" : "e.g. Software engineer"} /></label>
        <Field label="Short code" hint="Filled in from the name. Used in imports and reports.">
          <input name="key" required value={key} pattern="[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?" title="Lowercase letters, numbers and hyphens"
            onChange={(event) => { setKey(event.target.value); setKeyEdited(true); }} />
        </Field>
        {title === "departments" && <Dropdown label="Parent department" name="parentDepartmentKey" defaultValue=""
          options={[{ value: "", label: "None (top level)" }, ...items.filter((item) => item.status === "ACTIVE").map((item) => ({ value: item.key, label: item.name }))]} />}
        <Button variant="primary">Add {singular}</Button>
      </form>
      {error && <Notice>{error}</Notice>}
      {items.length ? (
        <Table headers={title === "departments" ? ["Name", "Short code", "Parent", "Status", ""] : ["Name", "Short code", "Status", ""]}>
          {items.map((i) => (
            <tr key={i.key}>
              <td><strong>{i.name}</strong></td>
              <td><code>{i.key}</code></td>
              {title === "departments" && <td>{i.parentDepartmentKey ? names.get(i.parentDepartmentKey) ?? i.parentDepartmentKey : "—"}</td>}
              <td><StatusBadge status={i.status} /></td>
              <td>
                <Button size="sm" onClick={() =>
                  void update(i.key, { status: i.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }).then(reload).catch((reason) =>
                    setError(reason instanceof ApiError ? reason.message : `Unable to update ${singular}`))}>
                  {i.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Empty>No {title} yet. Add one above, or skip this — {title} are optional and can be added later.</Empty>
      )}
    </Page>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return <article className="card">{children}</article>;
}
