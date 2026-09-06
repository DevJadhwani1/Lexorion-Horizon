import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../api/types";
import {
  createDepartment,
  createDesignation,
  createEmployee,
  getDepartments,
  getDesignations,
  getEmployee,
  getEmployeeHistory,
  getEmployees,
  getMe,
  getStructure,
  getTeam,
  mapEmployeeUser,
  transitionEmployee,
  updateEmployee,
  updateDepartment,
  updateDesignation,
  type Employee,
  type LifecycleEvent,
  type Reference,
  type Structure,
  type Team,
} from "../../features/workforce/workforceApi";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Empty, Notice, Page } from "../../components/ui/Page";
import { Table } from "../admin/AdminPage";
import { useAuth } from "../../auth/AuthProvider";
import { appPath } from "../../app/hostRouting";
export function WorkforcePage({ sectionKey }: { sectionKey?: string }) {
  const { section: routeSection, employeeCode } = useParams(),
    section = sectionKey ?? routeSection ?? "dashboard",
    [data, setData] = useState<unknown>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(
        await (employeeCode
          ? getEmployee(employeeCode)
          : section === "employees" || section === "dashboard"
            ? getEmployees("size=100")
            : section === "departments"
              ? getDepartments()
              : section === "designations"
                ? getDesignations()
                : section === "structure"
                  ? getStructure()
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
  }, [section, employeeCode]);
  if (loading)
    return (
      <Page title="Workforce">
        <p>Loading…</p>
      </Page>
    );
  if (error)
    return (
      <Page title="Workforce">
        <Notice>{error}</Notice>
      </Page>
    );
  if (employeeCode)
    return <EmployeeProfile employee={data as Employee} reload={load} />;
  if (section === "departments" || section === "designations")
    return (
      <References title={section} items={data as Reference[]} reload={load} />
    );
  if (section === "structure")
    return <StructurePage value={data as Structure} />;
  if (section === "me")
    return <EmployeeProfile employee={data as Employee} reload={load} self />;
  if (section === "team")
    return (
      <Page title="My team">
        {(data as Team).employees.length ? (
          <Table headers={["Employee", "Department", "Designation", "Status"]}>
            {(data as Team).employees.map((e) => (
              <tr key={e.employeeCode}>
                <td>
                  <Link to={appPath(`/app/workforce/employees/${e.employeeCode}`)}>
                    {e.name}
                  </Link>
                </td>
                <td>{e.departmentKey ?? "—"}</td>
                <td>{e.designationKey ?? "—"}</td>
                <td>
                  <Badge label={e.status} />
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>No direct reports.</Empty>
        )}
      </Page>
    );
  const employees = (data as { content: Employee[] }).content;
  return (
    <Page
      title={section === "dashboard" ? "Workforce dashboard" : "Employees"}
      description="Live workspace-scoped Workforce records."
    >
      {section === "employees" && <EmployeeCreate reload={load} />}{" "}
      {employees.length ? (
        <Table headers={["Code", "Name", "Email", "Department", "Status"]}>
          {employees.map((e) => (
            <tr key={e.employeeCode}>
              <td>
                <Link to={appPath(`/app/workforce/employees/${e.employeeCode}`)}>
                  {e.employeeCode}
                </Link>
              </td>
              <td>
                {e.firstName} {e.lastName}
              </td>
              <td>{e.workEmail}</td>
              <td>{e.departmentKey ?? "—"}</td>
              <td>
                <Badge
                  label={e.status}
                  variant={e.status === "ACTIVE" ? "success" : "neutral"}
                />
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Empty>No employees returned by Workforce.</Empty>
      )}
    </Page>
  );
}
function EmployeeCreate({ reload }: { reload(): Promise<void> }) {
  const [error, setError] = useState("");
  return (
    <details className="card">
      <summary>Add employee</summary>
      <form
        className="form-grid"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          const b = Object.fromEntries(
            Array.from(new FormData(e.currentTarget as HTMLFormElement).entries()).filter(([, value]) => value !== ""),
          );
          void createEmployee({ ...b, status: "ACTIVE" })
            .then(reload)
            .catch((x) => setError((x as Error).message));
        }}
      >
        {[
          "employeeCode",
          "firstName",
          "lastName",
          "workEmail",
          "phone",
          "joiningDate",
          "departmentKey",
          "designationKey",
          "reportingManagerEmployeeCode",
        ].map((n) => (
          <label key={n}>
            {n}
            <input
              required={[
                "employeeCode",
                "firstName",
                "lastName",
                "workEmail",
                "joiningDate",
              ].includes(n)}
              name={n}
              type={
                n === "joiningDate"
                  ? "date"
                  : n === "workEmail"
                    ? "email"
                    : "text"
              }
            />
          </label>
        ))}
        <Button variant="primary">Create</Button>
      </form>
      {error && <Notice>{error}</Notice>}
    </details>
  );
}
function EmployeeProfile({
  employee,
  reload,
  self = false,
}: {
  employee: Employee;
  reload(): Promise<void>;
  self?: boolean;
}) {
  const auth = useAuth(),
    admin = auth.organization?.membershipRole === "ADMIN";
  const [error, setError] = useState(""),
    [history, setHistory] = useState<LifecycleEvent[]>([]),
    [historyLoading, setHistoryLoading] = useState(admin && !self);
  useEffect(() => {
    if (!admin || self) return;
    setHistoryLoading(true);
    getEmployeeHistory(employee.employeeCode)
      .then(setHistory)
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Unable to load employee history"))
      .finally(() => setHistoryLoading(false));
  }, [admin, employee.employeeCode, self]);
  const transitions: Record<Employee["status"], string[]> = {
    ACTIVE: ["leave", "suspend", "resign", "terminate"],
    ON_LEAVE: ["activate", "terminate"],
    SUSPENDED: ["activate", "resign", "terminate"],
    RESIGNED: ["terminate"],
    TERMINATED: [],
  };
  return (
    <Page
      title={`${employee.firstName} ${employee.lastName}`}
      description={`${employee.employeeCode} · ${employee.workEmail}`}
    >
      <div className="cards">
        <article>
          <h3>Employment</h3>
          <p>
            Status: <Badge label={employee.status} />
          </p>
          <p>Joined: {employee.joiningDate}</p>
        </article>
        <article>
          <h3>Organization</h3>
          <p>Department: {employee.departmentKey ?? "—"}</p>
          <p>Designation: {employee.designationKey ?? "—"}</p>
          <p>Manager: {employee.reportingManagerEmployeeCode ?? "—"}</p>
        </article>
      </div>
      {error && <Notice>{error}</Notice>}
      {admin && !self && (
        <>
          <details className="card">
            <summary>Edit employee</summary>
            <form className="form-grid" onSubmit={(event: FormEvent) => {
              event.preventDefault();
              setError("");
              const form = new FormData(event.currentTarget as HTMLFormElement);
              const values: Record<string, unknown> = Object.fromEntries(Array.from(form.entries()).filter(([key, value]) =>
                value !== "" || key === "middleName" || key === "phone",
              ));
              if (form.get("reportingManagerEmployeeCode") === "") values.reportingManagerEmployeeCode = null;
              void updateEmployee(employee.employeeCode, values).then(reload)
                .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Unable to update employee"));
            }}>
              {employeeField("firstName", employee.firstName, true)}
              {employeeField("middleName", employee.middleName ?? "")}
              {employeeField("lastName", employee.lastName, true)}
              {employeeField("workEmail", employee.workEmail, true, "email")}
              {employeeField("phone", employee.phone ?? "")}
              {employeeField("joiningDate", employee.joiningDate, true, "date")}
              {employeeField("departmentKey", employee.departmentKey ?? "")}
              {employeeField("designationKey", employee.designationKey ?? "")}
              {employeeField("reportingManagerEmployeeCode", employee.reportingManagerEmployeeCode ?? "")}
              <Button variant="primary">Save employee</Button>
            </form>
          </details>
          <form
            className="toolbar"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              const email = String(
                new FormData(e.currentTarget as HTMLFormElement).get("email"),
              );
              void mapEmployeeUser(employee.employeeCode, email)
                .then(reload)
                .catch((x) => setError((x as Error).message));
            }}
          >
            <input
              name="email"
              type="email"
              placeholder="Platform member email"
              required
            />
            <Button>Map user</Button>
          </form>
          <div className="toolbar">
            {transitions[employee.status].map(
              (a) => (
                <Button
                  key={a}
                  onClick={() =>
                    confirm(`${a} ${employee.employeeCode}?`) &&
                    void transitionEmployee(employee.employeeCode, a)
                      .then(reload)
                      .catch((x) => setError((x as Error).message))
                  }
                >
                  {a}
                </Button>
              ),
            )}
          </div>
          <section className="card" aria-labelledby="employee-history-heading">
            <h3 id="employee-history-heading">Lifecycle history</h3>
            {historyLoading ? <p>Loading history…</p> : history.length ? (
              <Table headers={["Action", "Previous status", "New status", "Date"]}>
                {history.map((event) => <tr key={`${event.occurredAt}:${event.action}`}>
                  <td>{event.action}</td>
                  <td>{event.previousStatus ?? "—"}</td>
                  <td>{event.newStatus}</td>
                  <td>{new Date(event.occurredAt).toLocaleString()}</td>
                </tr>)}
              </Table>
            ) : <Empty>No lifecycle history.</Empty>}
          </section>
        </>
      )}
    </Page>
  );
}
function employeeField(name: string, value: string, required = false, type = "text") {
  return <label key={name}>{name.replaceAll(/([A-Z])/g, " $1")}
    <input name={name} type={type} required={required} defaultValue={value} />
  </label>;
}
function References({
  title,
  items,
  reload,
}: {
  title: string;
  items: Reference[];
  reload(): Promise<void>;
}) {
  const create = title === "departments" ? createDepartment : createDesignation,
    update = title === "departments" ? updateDepartment : updateDesignation;
  const [error, setError] = useState("");
  return (
    <Page title={title[0].toUpperCase() + title.slice(1)}>
      <form
        className="toolbar"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          const b = Object.fromEntries(
            Array.from(new FormData(e.currentTarget as HTMLFormElement).entries()).filter(([, value]) => value !== ""),
          );
          setError("");
          void create(b).then(reload).catch((reason) =>
            setError(reason instanceof ApiError ? reason.message : `Unable to create ${title.slice(0, -1)}`),
          );
        }}
      >
        <input name="key" placeholder="Stable key" required />
        <input name="name" placeholder="Display name" required />
        {title === "departments" && (
          <input
            name="parentDepartmentKey"
            placeholder="Parent key (optional)"
          />
        )}
        <Button variant="primary">Create</Button>
      </form>
      {error && <Notice>{error}</Notice>}
      {items.length ? (
        <Table headers={["Key", "Name", "Parent", "Status", "Action"]}>
          {items.map((i) => (
            <tr key={i.key}>
              <td>{i.key}</td>
              <td>{i.name}</td>
              <td>{i.parentDepartmentKey ?? "—"}</td>
              <td>
                <Badge label={i.status} />
              </td>
              <td>
                <Button
                  onClick={() =>
                    void update(i.key, {
                      status: i.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                    }).then(reload).catch((reason) =>
                      setError(reason instanceof ApiError ? reason.message : `Unable to update ${title.slice(0, -1)}`),
                    )
                  }
                >
                  {i.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Empty>No {title}.</Empty>
      )}
    </Page>
  );
}
function StructurePage({ value }: { value: Structure }) {
  return (
    <Page title="Organization structure">
      <div className="cards">
        <article>
          <h3>Departments</h3>
          {value.departments.map((d) => (
            <p key={d.departmentKey}>
              {d.name} {d.parentDepartmentKey && `← ${d.parentDepartmentKey}`}
            </p>
          ))}
        </article>
        <article>
          <h3>Reporting lines</h3>
          {value.employees.map((e) => (
            <p key={e.employeeCode}>
              {e.name}{" "}
              {e.reportingManagerEmployeeCode &&
                `→ ${e.reportingManagerEmployeeCode}`}
            </p>
          ))}
        </article>
      </div>
    </Page>
  );
}
export function Panel({ children }: { children: ReactNode }) {
  return <article className="card">{children}</article>;
}
