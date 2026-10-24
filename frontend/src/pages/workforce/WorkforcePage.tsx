import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ApiError, type Page as ResultPage } from "../../api/types";
import {
  createDepartment,
  createDesignation,
  getDepartments,
  getDesignations,
  getEmployee,
  getEmployeeHistory,
  getEmployees,
  getMe,
  getTeam,
  mapEmployeeUser,
  transitionEmployee,
  updateEmployee,
  updateDepartment,
  updateDesignation,
  type Employee,
  type EmploymentStatus,
  type LifecycleEvent,
  type Reference,
  type Team,
} from "../../features/workforce/workforceApi";
import { useWorkforceDirectory } from "../../features/workforce/useWorkforceDirectory";
import { getPayrollEmployee, getProfiles } from "../../features/payroll/payrollApi";
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
import { EmployeeFields } from "./EmployeeFields";
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
  const search = params.get("q") ?? "", status = params.get("status") ?? "", department = params.get("department") ?? "",
    designation = params.get("designation") ?? "", sort = params.get("sort") ?? "firstName", direction = params.get("direction") === "DESC" ? "DESC" : "ASC",
    page = Math.max(0, Number(params.get("page")) || 0);
  const [draft, setDraft] = useState(search);
  const [result, setResult] = useState<ResultPage<Employee> | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true);
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
    if (status) query.set("status", status);
    if (department) query.set("departmentKey", department);
    if (designation) query.set("designationKey", designation);
    setLoading(true); setError("");
    getEmployees(query.toString())
      .then((value) => { if (current) setResult(value); })
      .catch((reason) => { if (current) setError(reason instanceof ApiError ? reason.message : "Unable to load employees"); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [search, status, department, designation, sort, direction, page]);
  const filtered = Boolean(search || status || department || designation);
  const employees = result?.content ?? [];
  return (
    <Page title="Employees" description="Everyone in this workspace. Open an employee to update their details, status or payroll setup."
      actions={<Link className="button primary" to={appPath("/workforce/employees/new")}>Add employee</Link>}>
      <form className="toolbar filter-bar directory-filters" role="search" onSubmit={(event) => { event.preventDefault(); update({ q: draft.trim() }); }}>
        <label>Search employees<input type="search" placeholder="Name, email or employee code" value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
        <Dropdown label="Status" value={status} onChange={(next) => update({ status: next })}
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
      {loading && !result ? <p role="status">Loading employees…</p> : employees.length ? <>
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
        : <Empty><strong>No employees yet.</strong><br />Add your first employee to start building your team and payroll. <Link to={appPath("/workforce/employees/new")}>Add employee</Link></Empty>}
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
    [history, setHistory] = useState<LifecycleEvent[]>([]),
    [historyLoading, setHistoryLoading] = useState(admin && !self),
    [editing, setEditing] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!admin || self) return;
    setHistoryLoading(true);
    getEmployeeHistory(employee.employeeCode)
      .then(setHistory)
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Unable to load employee history"))
      .finally(() => setHistoryLoading(false));
  }, [admin, employee.employeeCode, self]);
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
            <div><dt>Joined</dt><dd>{formatDate(employee.joiningDate)}</dd></div>
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
          {transitions[employee.status].length > 0 && <section className="card" aria-labelledby="employee-status-heading">
            <h3 id="employee-status-heading">Employment status</h3>
            <div className="toolbar">
              {transitions[employee.status].map((action) => (
                <Button key={action} variant={action === "terminate" ? "destructive" : "secondary"} disabled={busy}
                  onClick={async () => {
                    if (!(await ask({ title: `${transitionLabels[action]} for ${name}?`, confirmLabel: transitionLabels[action], tone: action === "terminate" ? "destructive" : "primary",
                      body: action === "terminate" || action === "resign" ? "This is recorded in the employee’s history. Their employee code stays reserved and is not reused." : "This is recorded in the employee’s history." }))) return;
                    setBusy(true); setError("");
                    void transitionEmployee(employee.employeeCode, action)
                      .then(async () => { setSaved(`${transitionLabels[action]}: done.`); await reload(); })
                      .catch((x) => setError(x instanceof ApiError ? x.message : "Unable to change status"))
                      .finally(() => setBusy(false));
                  }}>
                  {transitionLabels[action] ?? humanize(action)}
                </Button>
              ))}
            </div>
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
            {historyLoading ? <p>Loading history…</p> : history.length ? (
              <Table headers={["Change", "From", "To", "Date"]}>
                {history.map((event) => <tr key={`${event.occurredAt}:${event.action}`}>
                  <td>{humanize(event.action)}</td>
                  <td>{event.previousStatus ? humanize(event.previousStatus) : "—"}</td>
                  <td>{humanize(event.newStatus)}</td>
                  <td>{new Date(event.occurredAt).toLocaleString()}</td>
                </tr>)}
              </Table>
            ) : <Empty>No status changes yet.</Empty>}
          </section>
        </>
      )}
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
  const setup = `${appPath("/workforce/employees/new")}?employee=${encodeURIComponent(employeeCode)}`;
  const compensation = `${appPath("/payroll/compensation")}?employee=${encodeURIComponent(employeeCode)}`;
  return <article>
    <h3>Payroll</h3>
    {state === "loading" && <p>Checking payroll setup…</p>}
    {state === "error" && <p>Payroll setup could not be checked. <Link to={compensation}>Open compensation</Link></p>}
    {state === "missing" && <><p>Not set up for payroll yet.</p><Link className="button primary" to={setup}>Set up payroll</Link></>}
    {state === "no-compensation" && <><p>Enrolled in payroll, but no salary has been set.</p><Link className="button primary" to={setup}>Add salary</Link></>}
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
