import { PayRunPreparation } from "./PayRunPreparation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/types";
import {
  assignSalaryTemplate,
  activateSalaryTemplateVersion,
  calculate,
  createComponent,
  createPayRun,
  createPayrollEmployee,
  createSalaryTemplate,
  createSalaryTemplateVersion,
  deactivateComponent,
  deactivateSalaryTemplate,
  deactivateSalaryTemplateVersion,
  finalizePayRun,
  getCalculations,
  getComponents,
  getLedger,
  getPayRun,
  getPayRunEmployees,
  getPayRuns,
  getPayrollEmployee,
  getPayrollEmployees,
  getPayslips,
  getProfiles,
  getSalaryTemplates,
  getSalaryTemplateVersions,
  processPayRun,
  recoverPayRun,
  updateComponent,
  updateSalaryTemplate,
  updateSalaryTemplateVersion,
  updatePayrollEmployee,
  type Calculation,
  type Component,
  type LedgerEntry,
  type PayRun,
  type PayRunEmployee,
  type PayrollEmployee,
  type Payslip,
  type Profile,
  type SalaryTemplate,
  type SalaryTemplateVersion,
} from "../../features/payroll/payrollApi";
import { workflowLink, workflowReturn } from "../../components/HorizonWorkflowNav";
import { Badge, StatusBadge } from "../../components/ui/Badge";
import { PersonCell } from "../../components/ui/PersonCell";
import { useWorkforceDirectory } from "../../features/workforce/useWorkforceDirectory";
import { useOrganizationDefaults } from "../../features/organization/useOrganizationDefaults";
import { formatDate, formatMoney, formatPeriod, humanize, payRunStatusDescription, personName } from "../../lib/format";
import { CompensationForm } from "./CompensationForm";
import { Button } from "../../components/ui/Button";
import { Empty, Notice, Page } from "../../components/ui/Page";
import { Table } from "../admin/AdminPage";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { appPath } from "../../app/hostRouting";
type TemplateData = {
  templates: SalaryTemplate[];
  components: Component[];
  employees: PayrollEmployee[];
};
export function PayrollPage({ sectionKey }: { sectionKey?: string }) {
  const { section: routeSection } = useParams(),
    section = sectionKey ?? routeSection ?? "dashboard",
    { workspace } = useWorkspace(),
    [data, setData] = useState<unknown>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(
        await (section === "components"
          ? getComponents()
          : section === "salary-templates"
            ? Promise.all([
                getSalaryTemplates(),
                getComponents(),
                getPayrollEmployees(),
              ]).then(([templates, components, employees]) => ({
                templates,
                components,
                employees,
              }))
            : section === "pay-runs"
              ? getPayRuns()
              : getPayrollEmployees()),
      );
    } catch (x) {
      setError(x instanceof ApiError ? x.message : "Unable to load Payroll");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [section, workspace?.key]);
  if (!workspace || !workspace.products.some(product => product.key === "payroll"))
    return (
      <Page title="Payroll">
        <Notice tone="info">
          Select an active Payroll workspace to use these APIs.
        </Notice>
      </Page>
    );
  if (["compensation", "calculations", "ledger", "payslips"].includes(section))
    return <EmployeeDetail section={section} />;
  if (loading && data === null)
    return (
      <Page title="Payroll">
        <p>Loading Payroll data…</p>
      </Page>
    );
  if (error)
    return (
      <Page title="Payroll">
        <Notice>{error}</Notice>
      </Page>
    );
  if (section === "components")
    return <Components items={data as Component[]} reload={load} />;
  if (section === "salary-templates")
    return <SalaryTemplates value={data as TemplateData} reload={load} />;
  if (section === "pay-runs")
    return (
      <PayRuns page={data as { content: PayRun[]; page: number; totalPages: number }} reload={load} />
    );
  return <PayrollEmployees employees={data as PayrollEmployee[]} reload={load} />;
}

/** Payroll enrollment list, joined to Workforce records for names, plus everyone who still needs payroll setup. */
function PayrollEmployees({ employees, reload }: { employees: PayrollEmployee[]; reload(): Promise<void> }) {
  const directory = useWorkforceDirectory();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");
  const enrolled = new Set(employees.map((employee) => employee.employeeCode.toUpperCase()));
  const pending = directory.employees.filter((employee) => !enrolled.has(employee.employeeCode.toUpperCase()) && (employee.status === "ACTIVE" || employee.status === "ON_LEAVE"));
  const requested = searchParams.get("employee");
  return (
    <Page title="Payroll employees" description="People who are set up to be paid in this workspace.">
      {error && <Notice>{error}</Notice>}
      {(requested || !directory.available || directory.error) && <EmployeeForm reload={reload} />}
      {pending.length > 0 && <section className="card" aria-labelledby="payroll-pending-heading">
        <h3 id="payroll-pending-heading">Not set up for payroll ({pending.length})</h3>
        <p className="snapshot-note">These employees exist in Horizon but cannot be paid until their payroll settings and salary are added.</p>
        <ul className="pending-list">
          {pending.slice(0, 10).map((employee) => <li key={employee.employeeCode}>
            <span><strong>{personName(employee)}</strong> <small>{employee.employeeCode}</small></span>
            <Link to={`${appPath("/app/workforce/employees/new")}?employee=${encodeURIComponent(employee.employeeCode)}`}>Set up payroll →</Link>
          </li>)}
        </ul>
        {pending.length > 10 && <p className="snapshot-note">And {pending.length - 10} more. Open each employee’s profile to continue.</p>}
      </section>}
      {employees.length ? (
        <Table headers={["Employee", "Pay frequency", "Currency", "Payroll start", "Status", ""]}>
          {employees.map((e) => (
            <tr key={e.employeeCode}>
              <td><PersonCell name={directory.nameOf(e.employeeCode)} code={e.employeeCode} /></td>
              <td>{humanize(e.payFrequency)}</td>
              <td>{e.currency}</td>
              <td>{formatDate(e.effectiveFrom)}</td>
              <td><StatusBadge status={e.status} /></td>
              <td className="row-actions">
                <Link to={`${appPath("/app/payroll/compensation")}?employee=${encodeURIComponent(e.employeeCode)}`}>Salary</Link>
                <Link to={`${appPath("/app/payroll/payslips")}?employee=${encodeURIComponent(e.employeeCode)}`}>Payslips</Link>
                <Button size="sm" onClick={() =>
                  confirm(`${e.status === "ACTIVE" ? "Stop paying" : "Resume paying"} ${directory.nameOf(e.employeeCode)}?`) &&
                  void updatePayrollEmployee(e.employeeCode, { status: e.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })
                    .then(reload)
                    .catch((x) => setError(x instanceof ApiError ? x.message : "Unable to update payroll employee"))}>
                  {e.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Empty><strong>Nobody is set up for payroll yet.</strong><br />{pending.length ? "Choose someone above to add their payroll settings and salary." : <>Add an employee first. <Link to={appPath("/app/workforce/employees/new")}>Add employee</Link></>}</Empty>
      )}
    </Page>
  );
}
/** Direct enrollment form, used when arriving from a setup link or when Workforce names are unavailable. */
function EmployeeForm({ reload }: { reload(): Promise<void> }) {
  const [searchParams] = useSearchParams(), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const defaults = useOrganizationDefaults();
  const initialCode = searchParams.get("employee") ?? "";
  return (
    <section className="card" aria-labelledby="payroll-enroll-heading">
      <h3 id="payroll-enroll-heading">Set up payroll for an employee</h3>
      <form
        className="form-grid"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setError(""); setBusy(true);
          const b = Object.fromEntries(
            new FormData(e.currentTarget as HTMLFormElement),
          );
          void createPayrollEmployee({ ...b, currency: String(b.currency).toUpperCase(), status: "ACTIVE" }).then(async () => {
            await reload();
            const next = `${appPath("/app/payroll/compensation")}?employee=${encodeURIComponent(String(b.employeeCode))}`;
            const back = workflowReturn(searchParams.toString());
            navigate(back ? workflowLink(next, back) : next);
          }).catch((x) => setError(x instanceof ApiError ? x.message : "Unable to set up payroll")).finally(() => setBusy(false));
        }}
      >
        {error && <Notice>{error}</Notice>}
        <label>Employee code<input name="employeeCode" required defaultValue={initialCode} /></label>
        <label key={defaults.currency}>Currency<input name="currency" required pattern="[A-Za-z]{3}" maxLength={3} defaultValue={defaults.currency} placeholder="e.g. INR" /></label>
        <label>
          Pay frequency
          <select name="payFrequency" defaultValue="MONTHLY">
            <option value="MONTHLY">Monthly</option>
            <option value="BIWEEKLY">Every two weeks</option>
            <option value="WEEKLY">Weekly</option>
          </select>
        </label>
        <label>Payroll start date<input name="effectiveFrom" type="date" required /></label>
        <Button variant="primary" disabled={busy}>{busy ? "Saving…" : "Save payroll settings"}</Button>
      </form>
    </section>
  );
}
function Components({
  items,
  reload,
}: {
  items: Component[];
  reload(): Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editingKey, setEditingKey] = useState<string | null>(null);
  const run = async (action: () => Promise<unknown>) => {
    setError("");
    setBusy(true);
    try {
      await action();
      await reload();
      return true;
    } catch (x) {
      setError(x instanceof ApiError ? x.message : "Unable to update component");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page title="Salary components" description="The earnings and deductions you can use in salaries and templates.">
      {error && <Notice>{error}</Notice>}
      <details className="card">
        <summary>Create component</summary>
        <form
          className="form-grid"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            const b = Object.fromEntries(
              new FormData(e.currentTarget as HTMLFormElement),
            );
            void run(() => createComponent({ ...b, status: "ACTIVE" }));
          }}
        >
          {input("componentKey", "", "text", {
            required: true,
            pattern: "[A-Za-z][A-Za-z0-9_]{0,63}",
            maxLength: 64,
            title: "Use 1-64 letters, numbers, or underscores; start with a letter.",
          })}
          {input("displayName", "", "text", {
            required: true,
            maxLength: 150,
          })}
          {select("category", ["EARNING", "DEDUCTION"])}
          {select("amountType", ["FIXED_AMOUNT", "PERCENTAGE"])}
          {select("occurrenceType", ["RECURRING", "ONE_TIME"])}
          {select("taxability", ["TAXABLE", "NON_TAXABLE"])}
          <Button variant="primary" disabled={busy}>
            {busy ? "Saving…" : "Create"}
          </Button>
        </form>
      </details>
      <Table
        headers={[
          "Key",
          "Name",
          "Category",
          "Type",
          "Occurrence",
          "Status",
          "Actions",
        ]}
      >
        {items.map((c) => (
          <tr key={c.componentKey}>
            <td>{c.componentKey}</td>
            <td>{c.displayName}</td>
            <td>{humanize(c.category)}</td>
            <td>{humanize(c.amountType)}</td>
            <td>{humanize(c.occurrenceType)}</td>
            <td>
              <StatusBadge status={c.status} />
            </td>
            <td>
              {editingKey === c.componentKey ? (
                <form
                  className="toolbar"
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    const name = String(
                      new FormData(e.currentTarget as HTMLFormElement).get(
                        "displayName",
                      ),
                    ).trim();
                    if (!name) {
                      setError("Component name is required.");
                      return;
                    }
                    void run(() =>
                      updateComponent(c.componentKey, { displayName: name }),
                    ).then((saved) => {
                      if (saved) setEditingKey(null);
                    });
                  }}
                >
                  <input
                    name="displayName"
                    defaultValue={c.displayName}
                    maxLength={150}
                    required
                    aria-label={`Name for ${c.componentKey}`}
                  />
                  <Button disabled={busy}>Save</Button>
                  <Button
                    type="button"
                    onClick={() => setEditingKey(null)}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                </form>
              ) : (
                <Button
                  onClick={() => setEditingKey(c.componentKey)}
                  disabled={busy}
                >
                  Edit
                </Button>
              )}{" "}
              <Button
                variant={c.status === "ACTIVE" ? "destructive" : "secondary"}
                disabled={busy}
                onClick={() => {
                  const next = c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
                  if (
                    c.status === "ACTIVE" &&
                    !confirm("Deactivate component?")
                  )
                    return;
                  void run(() =>
                    c.status === "ACTIVE"
                      ? deactivateComponent(c.componentKey)
                      : updateComponent(c.componentKey, { status: next }),
                  );
                }}
              >
                {c.status === "ACTIVE" ? "Deactivate" : "Activate"}
              </Button>
            </td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}
function SalaryTemplates({
  value,
  reload,
}: {
  value: TemplateData;
  reload(): Promise<void>;
}) {
  const { templates: items, components, employees } = value,
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [versions, setVersions] = useState<Record<string, SalaryTemplateVersion[]>>({}),
    [selectedVersions, setSelectedVersions] = useState<Record<string, number>>({});
  const defaults = useOrganizationDefaults();
  const activeComponents = components.filter((c) => c.status === "ACTIVE");
  const loadVersions = async () => {
    const entries = await Promise.all(
      items.map(async (template) => [template.templateKey, await getSalaryTemplateVersions(template.templateKey)] as const),
    );
    setVersions(Object.fromEntries(entries));
  };
  useEffect(() => {
    void loadVersions().catch((x) => setError(x instanceof ApiError ? x.message : "Unable to load template versions"));
  }, [items]);
  const run = async (action: () => Promise<unknown>) => {
    setError("");
    setBusy(true);
    try {
      await action();
      await reload();
      await loadVersions();
      return true;
    } catch (x) {
      setError(x instanceof ApiError ? x.message : "Unable to update salary template");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      title="Salary Templates"
      description="A template is a reusable configuration. Assigning it creates an independent employee compensation snapshot; later template changes do not rewrite that history."
    >
      <details className="card">
        <summary>Create salary template</summary>
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            const form = e.currentTarget as HTMLFormElement,
              f = new FormData(form),
              selected = f.getAll("selectedComponent").map(String);
            if (!selected.length) {
              setError("Select at least one active payroll component.");
              return;
            }
            setBusy(true);
            void createSalaryTemplate({
              templateKey: f.get("templateKey"),
              displayName: f.get("displayName"),
              description: f.get("description") || null,
              currency: f.get("currency"),
              payFrequency: f.get("payFrequency"),
              status: "ACTIVE",
              effectiveFrom: f.get("effectiveFrom"),
              components: selected.map((componentKey) => ({
                componentKey,
                value: Number(f.get(`value-${componentKey}`)),
              })),
            })
              .then(async () => {
                form.reset();
                await reload();
              })
              .catch((x) => setError((x as Error).message))
              .finally(() => setBusy(false));
          }}
        >
          <div className="form-grid">
            {input("templateKey")}
            {input("displayName")}
            {input("description")}
            <span key={defaults.currency} className="contents">{input("currency", defaults.currency, "text", { pattern: "[A-Z]{3}", maxLength: 3 })}</span>
            {select("payFrequency", ["MONTHLY", "BIWEEKLY", "WEEKLY"])}
            {input("effectiveFrom", "", "date")}
          </div>
          <fieldset className="component-picker">
            <legend>Components and configured values</legend>
            {activeComponents.length ? (
              activeComponents.map((c) => (
                <label className="component-choice" key={c.componentKey}>
                  <input
                    type="checkbox"
                    name="selectedComponent"
                    value={c.componentKey}
                  />
                  <span>
                    <strong>{c.displayName}</strong>
                    <small>
                      {label(c.category)} · {label(c.amountType)}
                    </small>
                  </span>
                  <input
                    aria-label={`${c.displayName} value`}
                    name={`value-${c.componentKey}`}
                    type="number"
                    min="0"
                    step="0.0001"
                    defaultValue="0"
                  />
                </label>
              ))
            ) : (
              <Empty>Create an active payroll component first.</Empty>
            )}
          </fieldset>
          <Button variant="primary" disabled={busy || !activeComponents.length}>
            {busy ? "Creating…" : "Create template"}
          </Button>
        </form>
      </details>
      {error && <Notice>{error}</Notice>}
      {items.length ? (
        items.map((t) => (
          <article className="card template-card" key={t.templateKey}>
            <div className="card-heading">
              <div>
                <h3>
                  {t.displayName} <Badge label={t.status} />
                </h3>
                <p>
                  <code>{t.templateKey}</code> · {t.currency} ·{" "}
                  {label(t.payFrequency)} · effective {t.effectiveFrom}
                  {t.effectiveTo ? ` to ${t.effectiveTo}` : ""}
                </p>
              </div>
              <Button
                variant={t.status === "ACTIVE" ? "destructive" : "secondary"}
                disabled={busy}
                onClick={() => {
                  if (t.status === "ACTIVE" && !confirm(`Deactivate ${t.displayName}?`)) return;
                  void run(() => t.status === "ACTIVE"
                    ? deactivateSalaryTemplate(t.templateKey)
                    : updateSalaryTemplate(t.templateKey, { status: "ACTIVE" }));
                }}
              >
                {t.status === "ACTIVE" ? "Deactivate" : "Activate"}
              </Button>
            </div>
            {t.description && <p>{t.description}</p>}
            <details className="card">
              <summary>Edit template metadata</summary>
              <form
                className="form-grid"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  const values = Object.fromEntries(new FormData(event.currentTarget as HTMLFormElement));
                  void run(() => updateSalaryTemplate(t.templateKey, values));
                }}
              >
                {input("displayName", t.displayName, "text", { required: true, maxLength: 150 })}
                {input("description", t.description ?? "", "text", { maxLength: 500 })}
                <Button disabled={busy}>Save metadata</Button>
              </form>
            </details>
            <Table
              headers={["Component", "Category", "Method", "Configured value"]}
            >
              {t.components.map((c) => (
                <tr key={c.componentKey}>
                  <td>
                    {c.displayName}
                    <br />
                    <small>{c.componentKey}</small>
                  </td>
                  <td>{label(c.category)}</td>
                  <td>{label(c.amountType)}</td>
                  <td>{money(c.value, t.currency)}</td>
                </tr>
              ))}
            </Table>
            <details className="card">
              <summary>Create draft version</summary>
              <form
                className="form-grid"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  const form = event.currentTarget as HTMLFormElement;
                  const data = new FormData(form);
                  const selected = data.getAll("versionComponent").map(String);
                  if (!selected.length) { setError("Select at least one active component."); return; }
                  void run(() => createSalaryTemplateVersion(t.templateKey, {
                    currency: data.get("versionCurrency"),
                    payFrequency: data.get("versionPayFrequency"),
                    status: "DRAFT",
                    effectiveFrom: data.get("versionEffectiveFrom"),
                    effectiveTo: data.get("versionEffectiveTo") || null,
                    components: selected.map((componentKey, index) => ({
                      componentKey,
                      value: Number(data.get(`version-value-${componentKey}`)),
                      percentageBasis: data.get(`version-basis-${componentKey}`) || null,
                      displaySequence: index,
                    })),
                  }));
                }}
              >
                {input("versionCurrency", t.currency, "text", { required: true, pattern: "[A-Z]{3}", maxLength: 3 })}
                {select("versionPayFrequency", ["MONTHLY", "BIWEEKLY", "WEEKLY"])}
                {input("versionEffectiveFrom", "", "date", { required: true })}
                {input("versionEffectiveTo", "", "date")}
                <fieldset className="component-picker">
                  <legend>Version components</legend>
                  {activeComponents.map((component) => (
                    <label className="component-choice" key={component.componentKey}>
                      <input type="checkbox" name="versionComponent" value={component.componentKey} />
                      <span><strong>{component.displayName}</strong><small>{label(component.category)} · {label(component.amountType)}</small></span>
                      <input name={`version-value-${component.componentKey}`} type="number" min="0" max={component.amountType === "PERCENTAGE" ? 100 : undefined} step="0.0001" defaultValue="0" aria-label={`${component.displayName} value`} />
                      {component.amountType === "PERCENTAGE" && <input name={`version-basis-${component.componentKey}`} placeholder="Percentage basis (optional)" aria-label={`${component.displayName} percentage basis`} />}
                    </label>
                  ))}
                </fieldset>
                <Button variant="primary" disabled={busy || !activeComponents.length}>{busy ? "Saving…" : "Create draft version"}</Button>
              </form>
            </details>
            <VersionHistory templateKey={t.templateKey} versions={versions[t.templateKey] ?? []} components={activeComponents} busy={busy} run={run} />
            <form
              className="toolbar assignment"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                const form = e.currentTarget as HTMLFormElement,
                  f = new FormData(form);
                const versionNumber = Number(f.get("versionNumber"));
                setBusy(true);
                void assignSalaryTemplate(
                  t.templateKey,
                  String(f.get("employeeCode")),
                  {
                    profileKey: String(f.get("profileKey")),
                    versionNumber,
                    effectiveFrom: String(f.get("effectiveFrom")),
                    effectiveTo: f.get("effectiveTo") ? String(f.get("effectiveTo")) : null,
                  },
                )
                  .then(() => {
                    form.reset();
                    setError("");
                  })
                  .catch((x) => setError((x as Error).message))
                  .finally(() => setBusy(false));
              }}
            >
              <strong>Assign as compensation snapshot</strong>
              <select
                name="employeeCode"
                aria-label="Employee"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select employee
                </option>
                {employees
                  .filter((e) => e.status === "ACTIVE")
                  .map((e) => (
                    <option key={e.employeeCode}>{e.employeeCode}</option>
                  ))}
              </select>
              <input name="profileKey" placeholder="Profile key" required />
              <label>
                Template version
                <select name="versionNumber" required value={selectedVersions[t.templateKey] ?? ""} onChange={(event) => setSelectedVersions((current) => ({ ...current, [t.templateKey]: Number(event.target.value) }))}>
                  <option value="" disabled>Select active version</option>
                  {(versions[t.templateKey] ?? []).filter((version) => version.status === "ACTIVE").map((version) => (
                    <option key={version.versionNumber} value={version.versionNumber}>Version {version.versionNumber} · {version.effectiveFrom}{version.effectiveTo ? ` to ${version.effectiveTo}` : ""}</option>
                  ))}
                </select>
              </label>
              <input
                name="effectiveFrom"
                aria-label="Effective from"
                type="date"
                required
              />
              <input name="effectiveTo" aria-label="Effective to" type="date" />
              {(() => {
                const selectedVersion = (versions[t.templateKey] ?? []).find((version) => version.versionNumber === selectedVersions[t.templateKey] && version.status === "ACTIVE");
                return selectedVersion ? <span className="employee-context">Version {selectedVersion.versionNumber}: {selectedVersion.components.map((component) => `${component.displayName} (${component.value}${component.amountType === "PERCENTAGE" ? "%" : ` ${selectedVersion.currency}`})`).join(", ")}</span> : <small>Select an active version to preview its snapshot components before assignment.</small>;
              })()}
              <Button disabled={busy || t.status !== "ACTIVE"}>
                Assign template
              </Button>
            </form>
          </article>
        ))
      ) : (
        <Empty>
          No salary templates. Create one from active payroll components.
        </Empty>
      )}
    </Page>
  );
}
function VersionHistory({
  templateKey,
  versions,
  components,
  busy,
  run,
}: {
  templateKey: string;
  versions: SalaryTemplateVersion[];
  components: Component[];
  busy: boolean;
  run(action: () => Promise<unknown>): Promise<boolean>;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  return (
    <section>
      <h3>Version history</h3>
      {!versions.length ? <Empty>No template versions.</Empty> : versions.map((version) => (
        <article className="card" key={version.versionNumber}>
          <div className="card-heading">
            <div>
              <h4>Version {version.versionNumber} <Badge label={version.status} /></h4>
              <p>{version.currency} · {label(version.payFrequency)} · effective {version.effectiveFrom}{version.effectiveTo ? ` to ${version.effectiveTo}` : ""}</p>
            </div>
            {version.status === "DRAFT" && <Button disabled={busy} onClick={() => void run(() => activateSalaryTemplateVersion(templateKey, version.versionNumber))}>Activate</Button>}
            {version.status === "ACTIVE" && <Button variant="destructive" disabled={busy} onClick={() => void run(() => deactivateSalaryTemplateVersion(templateKey, version.versionNumber))}>Deactivate</Button>}
          </div>
          {version.status === "DRAFT" && editing === version.versionNumber ? (
            <form className="form-grid" onSubmit={(event: FormEvent) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget as HTMLFormElement);
              const selected = data.getAll("editVersionComponent").map(String);
              if (!selected.length) return;
              void run(() => updateSalaryTemplateVersion(templateKey, version.versionNumber, {
                currency: data.get("currency"),
                payFrequency: data.get("payFrequency"),
                effectiveFrom: data.get("effectiveFrom"),
                effectiveTo: data.get("effectiveTo") || null,
                components: selected.map((componentKey, index) => ({
                  componentKey,
                  value: Number(data.get(`edit-value-${componentKey}`)),
                  percentageBasis: data.get(`edit-basis-${componentKey}`) || null,
                  displaySequence: index,
                })),
              })).then(() => setEditing(null));
            }}>
              {input("currency", version.currency, "text", { required: true, pattern: "[A-Z]{3}", maxLength: 3 })}
              {select("payFrequency", ["MONTHLY", "BIWEEKLY", "WEEKLY"])}
              {input("effectiveFrom", version.effectiveFrom, "date", { required: true })}
              {input("effectiveTo", version.effectiveTo ?? "", "date")}
              <fieldset className="component-picker">
                <legend>Draft components</legend>
                {components.map((component) => {
                  const existing = version.components.find((item) => item.componentKey === component.componentKey);
                  return <label className="component-choice" key={component.componentKey}>
                    <input type="checkbox" name="editVersionComponent" value={component.componentKey} defaultChecked={Boolean(existing)} />
                    <span><strong>{component.displayName}</strong><small>{label(component.category)} · {label(component.amountType)}</small></span>
                    <input name={`edit-value-${component.componentKey}`} type="number" min="0" max={component.amountType === "PERCENTAGE" ? 100 : undefined} step="0.0001" defaultValue={existing?.value ?? 0} aria-label={`${component.displayName} value`} />
                  </label>;
                })}
              </fieldset>
              <Button variant="primary" disabled={busy}>Save draft</Button>
              <Button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
            </form>
          ) : (
            <>
              <Table headers={["Component", "Category", "Method", "Value"]}>
                {version.components.map((component) => <tr key={component.componentKey}><td>{component.displayName}<br /><small>{component.componentKey}</small></td><td>{label(component.category)}</td><td>{label(component.amountType)}</td><td>{component.value} {component.amountType === "PERCENTAGE" ? "%" : version.currency}</td></tr>)}
              </Table>
              {version.status === "DRAFT" && <Button onClick={() => setEditing(version.versionNumber)} disabled={busy}>Edit draft</Button>}
            </>
          )}
        </article>
      ))}
    </section>
  );
}
function EmployeeDetail({ section }: { section: string }) {
  const [searchParams, setSearchParams] = useSearchParams(),
    [code, setCode] = useState(searchParams.get("employee")?.toUpperCase() ?? ""),
    [data, setData] = useState<
      Profile[] | Calculation[] | LedgerEntry[] | Payslip[] | null
    >(null),
    [employee, setEmployee] = useState<PayrollEmployee | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const loadVersion = useRef(0);
  const directory = useWorkforceDirectory();
  const defaults = useOrganizationDefaults();
  const [roster, setRoster] = useState<PayrollEmployee[]>([]);
  useEffect(() => { getPayrollEmployees().then(setRoster).catch(() => setRoster([])); }, []);
  const load = async (employeeCode = code, filters: Record<string, string> = {}) => {
    const normalizedCode = employeeCode.trim().toUpperCase();
    if (!normalizedCode) return;
    const version = ++loadVersion.current;
    setData(null); setEmployee(null);
    setError("");
    setLoading(true);
    try {
      const [records, payrollEmployee] = await Promise.all([
        section === "compensation"
          ? getProfiles(normalizedCode)
          : section === "calculations"
            ? getCalculations(normalizedCode)
            : section === "ledger"
              ? getLedger(normalizedCode, filters)
              : getPayslips(normalizedCode),
        getPayrollEmployee(normalizedCode),
      ]);
      if (version !== loadVersion.current) return;
      setCode(normalizedCode);
      setData(records);
      setEmployee(payrollEmployee);
    } catch (x) {
      if (version === loadVersion.current) setError((x as Error).message);
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  };
  const requestedEmployee = searchParams.get("employee");
  useEffect(() => {
    if (requestedEmployee) {
      const normalized = requestedEmployee.trim().toUpperCase();
      setCode(normalized);
      void load(normalized);
    }
    return () => { loadVersion.current++; };
  }, [requestedEmployee, section]);
  const title =
    section === "compensation"
      ? "Compensation"
      : section === "calculations"
        ? "Pay preview"
        : section === "ledger"
          ? "Payroll ledger"
          : "Payslips";
  const description = section === "compensation" ? "Each employee’s salary history. A new salary applies from its start date; earlier ones stay as history."
    : section === "calculations" ? "Check what an employee would be paid for a period before running payroll. Previews never pay anyone."
      : section === "ledger" ? "Locked payroll entries created when pay runs are finalized."
        : "Payslips from finalized pay runs.";
  const choose = (next: string) => {
    loadVersion.current++;
    setCode(next); setEmployee(null); setData(null); setLoading(false); setError("");
    setSearchParams(previous => { const params = new URLSearchParams(previous); if (next) params.set("employee", next); else params.delete("employee"); return params; });
  };
  return (
    <Page title={title} description={description}>
      <div className="toolbar employee-picker">
        <label>Employee
          <select value={roster.some((item) => item.employeeCode === code) ? code : code ? "__other" : ""} onChange={(event) => choose(event.target.value === "__other" ? code : event.target.value)}>
            <option value="">Choose an employee…</option>
            {code && !roster.some((item) => item.employeeCode === code) && <option value="__other">{code}</option>}
            {roster.map((item) => <option key={item.employeeCode} value={item.employeeCode}>{directory.nameOf(item.employeeCode)}{directory.find(item.employeeCode) ? ` (${item.employeeCode})` : ""}{item.status === "ACTIVE" ? "" : " · inactive"}</option>)}
          </select>
        </label>
        {loading && <span role="status">Loading…</span>}
      </div>
      {error && <Notice>{error}<p><Link to={workflowLink(`${appPath("/app/payroll/employees")}?employee=${encodeURIComponent(code)}`, `${appPath(`/app/payroll/${section}`)}?employee=${encodeURIComponent(code)}`)}>Review payroll employee configuration</Link></p></Notice>}
      {!code && <Notice tone="info">{roster.length ? "Choose an employee to continue." : <>Nobody is set up for payroll yet. <Link to={appPath("/app/payroll/employees")}>Set up payroll employees</Link></>}</Notice>}
      {employee && (
        <div className="employee-context">
          <strong>{directory.nameOf(employee.employeeCode)}</strong>
          {directory.find(employee.employeeCode) && <span>{employee.employeeCode}</span>}
          <span>{humanize(employee.payFrequency)} · {employee.currency}</span>
          <StatusBadge status={employee.status} />
        </div>
      )}
      {section === "compensation" && employee && data && <ProfileForm employee={employee} profiles={data as Profile[]} locale={defaults.locale} reload={load} />}
      {section === "calculations" && employee && <p className="snapshot-note">Choose any date inside the pay period you want to check. The preview uses the salary in effect for that whole period.</p>}
      {section === "calculations" && (
        <form
          className="toolbar"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            const date = String(
              new FormData(e.currentTarget as HTMLFormElement).get("date"),
            );
            void calculate(employee!.employeeCode, date)
              .then(() => load())
              .catch((x) => setError((x as Error).message));
          }}
        >
          <label>Date in pay period<input type="date" name="date" required /></label>
          <Button variant="primary" disabled={!employee || loading}>Calculate</Button>
        </form>
      )}
      {section === "ledger" && data && (
        <form
          className="toolbar filter-bar"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            const values = Object.fromEntries(
              new FormData(event.currentTarget as HTMLFormElement),
            ) as Record<string, string>;
            void load(code, values);
          }}
        >
          <label>
            From
            <input name="fromDate" type="date" />
          </label>
          <label>
            To
            <input name="toDate" type="date" />
          </label>
          <label>
            Pay run
            <input name="payRunKey" placeholder="Optional" />
          </label>
          <label>
            Entry type
            <select name="type" defaultValue="">
              <option value="">All types</option>
              {[
                "EARNING",
                "DEDUCTION",
                "EMPLOYER_CONTRIBUTION",
                "ADJUSTMENT",
                "NET_PAY",
              ].map((type) => (
                <option key={type} value={type}>
                  {label(type)}
                </option>
              ))}
            </select>
          </label>
          <Button>Apply filters</Button>
        </form>
      )}
      {data && data.length === 0 && section !== "compensation" && <Empty>{section === "calculations" ? "No previews yet. Choose a date above to see what this employee would be paid." : "Nothing here yet. Results appear after a pay run including this employee is finalized."}</Empty>}
      {employee && <nav className="toolbar section-tabs" aria-label="Employee payroll workflow">
        <Link to={`${appPath("/app/payroll/compensation")}?employee=${encodeURIComponent(employee.employeeCode)}`}>Salary</Link>
        <Link to={`${appPath("/app/payroll/calculations")}?employee=${encodeURIComponent(employee.employeeCode)}`}>Pay preview</Link>
        <Link to={`${appPath("/app/payroll/payslips")}?employee=${encodeURIComponent(employee.employeeCode)}`}>Payslips</Link>
        <Link to={`${appPath("/app/payroll/ledger")}?employee=${encodeURIComponent(employee.employeeCode)}`}>Ledger</Link>
        {directory.find(employee.employeeCode) && <Link to={appPath(`/app/workforce/employees/${employee.employeeCode}`)}>Employee profile</Link>}
      </nav>}
      {section === "compensation" && employee && <p className="snapshot-note">Need another pay component? <Link to={workflowLink(appPath("/app/payroll/components"), `${appPath("/app/payroll/compensation")}?employee=${encodeURIComponent(employee.employeeCode)}`)}>Manage salary components</Link>, then return here.</p>}
      {data &&
        section === "compensation" &&
        (data as Profile[]).map((p) => (
          <article className="card" key={p.profileKey}>
            <h3>
              Salary from {formatDate(p.effectiveFrom)} <StatusBadge status={p.status} />
            </h3>
            <p>
              {p.sourceTemplateKey ? (
                <>
                  Created from template <strong>{p.sourceTemplateKey}</strong>{" "}
                  {p.sourceTemplateVersion ? <>version <strong>{p.sourceTemplateVersion}</strong>{" "}</> : null}
                  ·{" "}
                </>
              ) : (
                <>Created directly · </>
              )}
              {p.currency} · {formatDate(p.effectiveFrom)} to {p.effectiveTo ? formatDate(p.effectiveTo) : "ongoing"} · <small>{p.profileKey}</small>
            </p>
            <p className="snapshot-note">
              Saved salaries are kept as history and are not edited. To change pay, add a new salary with a later start date.
            </p>
            <Table
              headers={["Component", "Category", "Method", "Configured value"]}
            >
              {p.components.map((c) => (
                <tr key={c.componentKey}>
                  <td>
                    {c.displayName}
                    <br />
                    <small>{c.componentKey}</small>
                  </td>
                  <td>{label(c.category)}</td>
                  <td>{label(c.amountType)}</td>
                  <td>{c.amountType === "PERCENTAGE" ? `${c.value}%` : money(c.value, p.currency)}</td>
                </tr>
              ))}
            </Table>
          </article>
        ))}
      {data &&
        section === "calculations" &&
        (data as Calculation[]).map((c, calculationIndex) => (
          <article
            className="card"
            key={`${c.calculationDate}-${calculationIndex}`}
          >
            <h3>{c.periodStart && c.periodEnd ? formatPeriod(c.periodStart, c.periodEnd) : formatDate(c.calculationDate)}</h3>
            <p className="snapshot-note">{c.periodStart && c.periodEnd ? `Previewed for ${formatDate(c.calculationDate)}` : "Older preview: the pay period was not recorded"}</p>
            <p>
              Gross <strong>{money(c.grossAmount, c.currency)}</strong> · Deductions <strong>{money(c.deductionAmount, c.currency)}</strong> · Net <strong>{money(c.netAmount, c.currency)}</strong>
            </p>
            <div className="payslip-columns">
              <section>
                <h4>Earnings</h4>
                {c.lines.filter((line) => line.category === "EARNING").map((l) => (
                  <p key={l.componentKey}>
                    {l.displayName}: {money(l.calculatedAmount, c.currency)}{l.percentageBasis ? ` (${label(l.percentageBasis)})` : ""}
                  </p>
                ))}
              </section>
              <section>
                <h4>Deductions</h4>
                {c.lines.filter((line) => line.category === "DEDUCTION").map((l) => (
                  <p key={l.componentKey}>
                    {l.displayName}: {money(l.calculatedAmount, c.currency)}{l.percentageBasis ? ` (${label(l.percentageBasis)})` : ""}
                  </p>
                ))}
              </section>
            </div>
          </article>
        ))}
      {data && section === "ledger" && (
        <Table
          headers={[
            "Entry date",
            "Period",
            "Pay run",
            "Type",
            "Component",
            "Effect",
            "Amount",
            "Reference / status",
          ]}
        >
          {(data as LedgerEntry[]).map((e) => (
            <tr key={e.sourceReference}>
              <td>{formatDate(e.entryDate)}</td>
              <td>{formatPeriod(e.periodStart, e.periodEnd)}</td>
              <td>{e.payRunKey}</td>
              <td>{label(e.type)}</td>
              <td>{e.componentName ?? "Net pay"}</td>
              <td className={e.amount >= 0 ? "positive" : "negative"}>
                {e.amount >= 0
                  ? "Increases pay"
                  : e.type === "NET_PAY"
                    ? "Balancing net pay"
                    : "Reduces pay"}
              </td>
              <td>{money(e.amount, e.currency)}</td>
              <td>
                <code>{e.sourceReference}</code>
                <br />
                <Badge label={e.status} />
              </td>
            </tr>
          ))}
        </Table>
      )}
      {data &&
        section === "payslips" &&
        (data as Payslip[]).map((p) => (
          <article className="card payslip" key={p.payRunKey}>
            <header>
              <div>
                <small>PAYSLIP · {formatPeriod(p.periodStart, p.periodEnd).toUpperCase()}</small>
                <h3>{directory.nameOf(p.employeeCode)}</h3>
                <p>{p.employeeCode} · Pay run {p.payRunKey}</p>
              </div>
              <StatusBadge status="FINALIZED" />
            </header>
            <dl>
              <div>
                <dt>Pay period</dt>
                <dd>{formatPeriod(p.periodStart, p.periodEnd)}</dd>
              </div>
              <div>
                <dt>Pay date</dt>
                <dd>{formatDate(p.calculationDate)}</dd>
              </div>
              <div>
                <dt>Finalized</dt>
                <dd>{new Date(p.finalizedAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Currency</dt>
                <dd>{p.currency}</dd>
              </div>
            </dl>
            <div className="payslip-columns">
              <section>
                <h4>Earnings</h4>
                {p.earnings.map((l) => (
                  <p key={l.componentKey}>
                    <span>{l.displayName}</span>
                    <strong>{money(l.amount, p.currency)}</strong>
                  </p>
                ))}
              </section>
              <section>
                <h4>Deductions</h4>
                {p.deductions.length ? (
                  p.deductions.map((l) => (
                    <p key={l.componentKey}>
                      <span>{l.displayName}</span>
                      <strong>{money(l.amount, p.currency)}</strong>
                    </p>
                  ))
                ) : (
                  <p>No deductions</p>
                )}
              </section>
            </div>
            <footer>
              <div>
                <span>Gross pay</span>
                <strong>{money(p.grossAmount, p.currency)}</strong>
              </div>
              <div>
                <span>Total deductions</span>
                <strong>{money(p.deductionAmount, p.currency)}</strong>
              </div>
              <div className="net">
                <span>Net pay</span>
                <strong>{money(p.netAmount, p.currency)}</strong>
              </div>
            </footer>
          </article>
        ))}
    </Page>
  );
}
function ProfileForm({ employee, profiles, locale, reload }: { employee: PayrollEmployee; profiles: Profile[]; locale?: string; reload(): Promise<void> }) {
  const [success, setSuccess] = useState("");
  const hasSalary = profiles.some((profile) => profile.status === "ACTIVE" && profile.components.length > 0);
  return (
    <details className="card" open={!hasSalary}>
      <summary>{hasSalary ? "Add a new salary" : "Set salary"}</summary>
      {success && <Notice tone="success">{success}</Notice>}
      <CompensationForm employee={employee} profiles={profiles} locale={locale}
        onSaved={async () => { setSuccess("Salary saved."); await reload(); }} />
    </details>
  );
}
function PayRuns({
  page,
  reload,
}: {
  page: { content: PayRun[]; page: number; totalPages: number };
  reload(): Promise<void>;
}) {
  const [selected, setSelected] = useState<PayRun | null>(null),
    [employees, setEmployees] = useState<PayRunEmployee[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [creating, setCreating] = useState(false);
  const directory = useWorkforceDirectory();
  const [view, setView] = useState(page);
  useEffect(() => setView(page), [page]);
  const runs = view.content;
  const [searchParams] = useSearchParams();
  const requestedRun = searchParams.get("run");
  useEffect(() => {
    if (!requestedRun) return;
    let active = true;
    setSelected(null); setEmployees([]); setError(""); setBusy(true);
    void Promise.all([getPayRun(requestedRun), getPayRunEmployees(requestedRun)])
      .then(([run, included]) => { if (active) { setSelected(run); setEmployees(included); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to open pay run"); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [requestedRun]);
  const open = async (r: PayRun) => {
    setSelected(r);
    setCreating(false);
    try {
      setEmployees(await getPayRunEmployees(r.payRunKey));
    } catch (x) {
      setError((x as Error).message);
    }
  };
  const mutate = async (action: () => Promise<PayRun>) => {
    setBusy(true);
    setError("");
    try {
      const updated = await action();
      setSelected(updated);
      await open(updated);
      await reload();
    } catch (x) {
      setError((x instanceof ApiError ? x.message : "Unable to update pay run") + (selected?.status === "CALCULATED" ? " Refresh the run. If it is still Calculated, retry Finalize; if Finalized, review its ledger." : ""));
      if (selected) {
        try { await open(await getPayRun(selected.payRunKey)); }
        catch { /* Keep the actionable original error if the service is unavailable. */ }
      }
      await reload();
    } finally {
      setBusy(false);
    }
  };
  const goToPage = async (next: number) => {
    setBusy(true);
    try { setView(await getPayRuns(next)); }
    catch (x) { setError(x instanceof ApiError ? x.message : "Unable to load pay runs"); }
    finally { setBusy(false); }
  };
  const showCreate = creating || (!runs.length && !selected);
  return (
    <Page title="Pay runs" description="Pick a pay period, choose who to pay, then calculate, review and finalize."
      actions={!showCreate ? <Button variant="primary" onClick={() => { setCreating(true); setSelected(null); }}>New pay run</Button> : undefined}>
      {showCreate && <NewPayRun runs={runs} onCancel={runs.length ? () => setCreating(false) : undefined}
        onCreated={async (run) => { await open(run); await reload(); }} />}
      {error && <Notice>{error}</Notice>}
      {selected && <PayRunDetail run={selected} employees={employees} busy={busy} nameOf={directory.nameOf} mutate={mutate}
        onPrepared={async () => { await open(await getPayRun(selected.payRunKey)); await reload(); }} onClose={() => setSelected(null)} />}
      {runs.length > 0 && <section aria-labelledby="pay-run-history-heading">
        <h2 id="pay-run-history-heading" className="section-heading">All pay runs</h2>
        <Table headers={["Pay run", "Period", "Status", "Employees", "Net pay", ""]}>
          {runs.map((r) => (
            <tr key={r.payRunKey} className={selected?.payRunKey === r.payRunKey ? "selected-row" : undefined}>
              <td><strong>{r.payRunKey}</strong></td>
              <td>{formatPeriod(r.periodStart, r.periodEnd)}</td>
              <td><StatusBadge status={r.status} /></td>
              <td>{r.employeeCount}</td>
              <td>{r.status === "DRAFT" || r.status === "FAILED" ? "—" : money(r.netTotal, r.currency)}</td>
              <td><Button size="sm" onClick={() => void open(r)}>Open</Button></td>
            </tr>
          ))}
        </Table>
      </section>}
      {view.totalPages > 1 && (
        <div className="toolbar">
          <Button disabled={busy || view.page === 0} onClick={() => void goToPage(view.page - 1)}>Previous</Button>
          <span>Page {view.page + 1} of {view.totalPages}</span>
          <Button disabled={busy || view.page + 1 >= view.totalPages} onClick={() => void goToPage(view.page + 1)}>Next</Button>
        </div>
      )}
    </Page>
  );
}

function PayRunDetail({ run, employees, busy, nameOf, mutate, onPrepared, onClose }: {
  run: PayRun; employees: PayRunEmployee[]; busy: boolean; nameOf(code: string): string;
  mutate(action: () => Promise<PayRun>): Promise<void>; onPrepared(): Promise<void>; onClose(): void;
}) {
  const returnTo = `${appPath("/app/payroll/pay-runs")}?run=${encodeURIComponent(run.payRunKey)}`;
  const steps = ["Choose employees", "Calculate", "Review & finalize"];
  const position = run.status === "DRAFT" || run.status === "FAILED" ? 0 : run.status === "PROCESSING" ? 1 : run.status === "CALCULATED" ? 2 : 3;
  return (
    <article className="card pay-run-detail" aria-label={`Pay run ${run.payRunKey}`}>
      <div className="card-heading">
        <div>
          <h3>{run.payRunKey} <StatusBadge status={run.status} /></h3>
          <p>{formatPeriod(run.periodStart, run.periodEnd)} · pay date {formatDate(run.calculationDate)} · {run.currency}</p>
          <p className="snapshot-note">{payRunStatusDescription[run.status] ?? ""}</p>
        </div>
        <Button size="sm" onClick={onClose}>Close</Button>
      </div>
      <ol className="stepper compact" aria-label="Pay run progress">
        {steps.map((title, index) => <li key={title} className={index < position ? "done" : index === position ? "current" : ""} aria-current={index === position ? "step" : undefined}>
          <span>{index < position ? "✓" : index + 1}</span>{title}
        </li>)}
      </ol>
      {run.status === "DRAFT" && <PayRunPreparation key={run.payRunKey} run={run} busy={busy} nameOf={nameOf}
        onSaved={onPrepared}
        onProcess={() => { if (confirm("Calculate pay for the selected employees?")) void mutate(() => processPayRun(run.payRunKey)); }} />}
      {run.status !== "DRAFT" && <>
        {(run.status === "CALCULATED" || run.status === "FINALIZED") && <dl className="pay-estimate run-totals" aria-label="Pay run totals">
          <div><dt>Employees</dt><dd>{run.employeeCount}</dd></div>
          <div><dt>Gross pay</dt><dd>{money(run.grossTotal, run.currency)}</dd></div>
          <div><dt>Deductions</dt><dd>{money(run.deductionTotal, run.currency)}</dd></div>
          <div className="net"><dt>Net pay</dt><dd>{money(run.netTotal, run.currency)}</dd></div>
        </dl>}
        {employees.length ? (
          <Table headers={["Employee", "Gross", "Deductions", "Net pay", ""]}>
            {employees.map((e) => (
              <tr key={e.employeeCode}>
                <td><PersonCell name={nameOf(e.employeeCode)} code={e.employeeCode} /></td>
                <td>{money(e.grossAmount, e.currency)}</td>
                <td>{money(e.deductionAmount, e.currency)}</td>
                <td><strong>{money(e.netAmount, e.currency)}</strong></td>
                <td className="row-actions">{run.status === "FINALIZED" ? <>
                  <Link to={workflowLink(`${appPath("/app/payroll/payslips")}?employee=${encodeURIComponent(e.employeeCode)}`, returnTo)}>Payslip</Link>
                  <Link to={workflowLink(`${appPath("/app/payroll/ledger")}?employee=${encodeURIComponent(e.employeeCode)}`, returnTo)}>Ledger</Link>
                </> : <Link to={workflowLink(`${appPath("/app/payroll/compensation")}?employee=${encodeURIComponent(e.employeeCode)}`, returnTo)}>Review compensation</Link>}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>No employees have been included in this pay run.</Empty>
        )}
      </>}
      <div className="toolbar">
        {run.status === "CALCULATED" && (
          <Button variant="primary" disabled={busy}
            onClick={() => confirm(`Finalize ${run.payRunKey}? Net pay of ${money(run.netTotal, run.currency)} for ${run.employeeCount} employee${run.employeeCount === 1 ? "" : "s"} will be locked and payslips issued. This cannot be undone.`) && void mutate(() => finalizePayRun(run.payRunKey))}>
            Finalize
          </Button>
        )}
        {run.status === "CALCULATED" && <Button disabled={busy} onClick={() => confirm("Return this run to Draft? Previous calculation snapshots remain in history; process again before finalizing.") && void mutate(() => recoverPayRun(run.payRunKey))}>Reset for recalculation</Button>}
        {run.status === "FINALIZED" && (
          <Notice tone="success">
            Finalized payroll is immutable. Open each employee’s payslip or ledger above to review the results.
          </Notice>
        )}
        {run.status === "PROCESSING" && (
          <Button disabled={busy} onClick={() => void mutate(() => getPayRun(run.payRunKey))}>Refresh processing state</Button>
        )}
        {(run.status === "FAILED" || run.status === "PROCESSING") && <>
          <Notice>{run.failureMessage || (run.status === "FAILED" ? "Processing failed. Correct compensation or service availability, recover to draft, then process again. For incorrect immutable period dates, create a new run." : "Refresh before recovery. Abandoned processing can be recovered after five minutes; an active transaction must finish first.")}</Notice>
          <Button disabled={busy} onClick={() => void mutate(() => recoverPayRun(run.payRunKey))}>Recover to draft</Button>
        </>}
      </div>
    </article>
  );
}

/** First and last day of a `YYYY-MM` month as ISO dates. */
export function monthPeriod(month: string): { start: string; end: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

/** The month after the latest known run, or the current month when there are no runs. */
export function suggestedPayMonth(runs: PayRun[], today = new Date()): string {
  const latest = runs.map((run) => run.periodEnd).sort().at(-1);
  if (!latest) return today.toISOString().slice(0, 7);
  const next = new Date(`${latest}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 7);
}

/**
 * Creates a draft run from a pay month: key, period, pay date and currency are derived from existing settings.
 * Weekly and biweekly employees need an aligned custom period, which remains available.
 */
function NewPayRun({ runs, onCreated, onCancel }: { runs: PayRun[]; onCreated(run: PayRun): Promise<void>; onCancel?(): void }) {
  const defaults = useOrganizationDefaults();
  const [roster, setRoster] = useState<PayrollEmployee[] | null>(null);
  useEffect(() => { getPayrollEmployees().then(setRoster).catch(() => setRoster([])); }, []);
  const [month, setMonth] = useState(() => suggestedPayMonth(runs));
  const [custom, setCustom] = useState(false);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const active = (roster ?? []).filter((employee) => employee.status === "ACTIVE");
  const counts = new Map<string, number>();
  for (const employee of active) counts.set(employee.currency, (counts.get(employee.currency) ?? 0) + 1);
  const rosterCurrency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const currency = rosterCurrency ?? defaults.currency;
  const otherFrequencies = active.filter((employee) => employee.payFrequency !== "MONTHLY").length;
  const monthly = active.length - otherFrequencies;
  const period = month ? monthPeriod(month) : { start: "", end: "" };
  const taken = new Set(runs.map((run) => run.payRunKey));
  let key = month ? `PAY-${month}` : "", suffix = 2;
  while (taken.has(key)) key = `PAY-${month}-${suffix++}`;
  const monthName = month ? new Intl.DateTimeFormat(defaults.locale ?? "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`)) : "";
  const submit = (body: Record<string, unknown>) => {
    setBusy(true); setError("");
    void createPayRun(body).then(onCreated)
      .catch((x) => setError(x instanceof ApiError && x.status === 409 ? `${x.message}. Open the existing run below, or choose another period.` : x instanceof ApiError ? x.message : "Unable to create pay run"))
      .finally(() => setBusy(false));
  };
  return (
    <section className="card new-pay-run" aria-labelledby="new-pay-run-heading">
      <div className="card-heading">
        <h3 id="new-pay-run-heading">New pay run</h3>
        {onCancel && <Button size="sm" type="button" onClick={onCancel}>Cancel</Button>}
      </div>
      {error && <Notice>{error}</Notice>}
      {roster !== null && active.length === 0 && <Notice tone="info">Nobody is set up for payroll yet. <Link to={appPath("/app/payroll/employees")}>Set up payroll employees</Link> first — you can still create a draft now.</Notice>}
      {!custom ? <form onSubmit={(event: FormEvent) => {
        event.preventDefault();
        submit({ payRunKey: key, periodStart: period.start, periodEnd: period.end, calculationDate: period.end, currency });
      }}>
        <div className="form-grid">
          <label>Pay month<input type="month" required value={month} onChange={(event) => setMonth(event.target.value)} /></label>
        </div>
        {month && <p className="run-summary">
          <strong>{monthName}</strong> · {formatPeriod(period.start, period.end)} · pay date {formatDate(period.end)} · {currency || "currency not set"}
          {roster !== null && active.length > 0 && <> · {monthly} monthly employee{monthly === 1 ? "" : "s"}</>}
        </p>}
        {otherFrequencies > 0 && <p className="snapshot-note">{otherFrequencies} employee{otherFrequencies === 1 ? " is" : "s are"} paid weekly or every two weeks and will show as blocked in a monthly run. Use a custom period for them.</p>}
        {!currency && defaults.loaded && <Notice>Set your organization’s currency in <Link to={appPath("/organization/settings")}>Settings</Link> before creating a pay run.</Notice>}
        <div className="form-actions">
          <Button variant="primary" disabled={busy || !month || !currency}>{busy ? "Creating…" : `Create ${monthName || "pay run"} draft`}</Button>
          <Button type="button" onClick={() => setCustom(true)}>Use a custom period</Button>
        </div>
      </form> : <form className="form-grid" onSubmit={(event: FormEvent) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.currentTarget as HTMLFormElement));
        submit({ ...values, payRunKey: String(values.payRunKey).toUpperCase(), currency: String(values.currency).toUpperCase() });
      }}>
        <label>Pay run name<input name="payRunKey" required defaultValue={key} pattern="[A-Za-z0-9][A-Za-z0-9._\-]{0,63}" title="Letters, numbers, dots, hyphens or underscores" /></label>
        <label>Period start<input name="periodStart" type="date" required defaultValue={period.start} /></label>
        <label>Period end<input name="periodEnd" type="date" required defaultValue={period.end} /></label>
        <label>Pay date<input name="calculationDate" type="date" required defaultValue={period.end} /></label>
        <label key={currency}>Currency<input name="currency" required pattern="[A-Za-z]{3}" maxLength={3} defaultValue={currency} /></label>
        <p className="snapshot-note form-wide">Use a full calendar month, or a 7- or 14-day period aligned to the employees’ payroll start dates. Partial periods are not pro-rated.</p>
        <div className="form-actions form-wide">
          <Button variant="primary" disabled={busy}>{busy ? "Creating…" : "Create draft"}</Button>
          <Button type="button" onClick={() => setCustom(false)}>Back to monthly</Button>
        </div>
      </form>}
    </section>
  );
}
const input = (
  name: string,
  value = "",
  type = "text",
  options: React.InputHTMLAttributes<HTMLInputElement> = {},
) => (
  <label key={name}>
    {label(name)}
    <input
      name={name}
      defaultValue={value}
      type={type}
      required={!name.startsWith("effectiveTo")}
      {...options}
    />
  </label>
);
const select = (name: string, items: string[]) => (
  <label key={name}>
    {label(name)}
    <select name={name}>
      {items.map((x) => (
        <option key={x} value={x}>{label(x)}</option>
      ))}
    </select>
  </label>
);
const label = (value: string) =>
  value
    .replaceAll("_", " ")
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
const money = (value: number, currency: string) => formatMoney(value, currency);
