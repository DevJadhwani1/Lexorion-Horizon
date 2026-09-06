import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../api/types";
import {
  addPayRunEmployee,
  assignSalaryTemplate,
  activateSalaryTemplateVersion,
  calculate,
  createComponent,
  createPayRun,
  createPayrollEmployee,
  createProfile,
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
import { Badge } from "../../components/ui/Badge";
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
  if (loading)
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
  const employees = data as PayrollEmployee[];
  if (section === "dashboard")
    return <PayrollDashboard employeeCount={employees.length} />;
  return (
    <Page
      title="Payroll employees"
      description="Employees configured for payroll in the selected workspace."
    >
      <EmployeeForm reload={load} />
      {employees.length ? (
        <Table
          headers={[
            "Employee",
            "Status",
            "Currency",
            "Frequency",
            "Effective",
            "History",
            "Action",
          ]}
        >
          {employees.map((e) => (
            <tr key={e.employeeCode}>
              <td>{e.employeeCode}</td>
              <td>
                <Badge label={e.status} />
              </td>
              <td>{e.currency}</td>
              <td>{label(e.payFrequency)}</td>
              <td>{e.effectiveFrom}</td>
              <td>
                <Link
                  to={`${appPath("/app/payroll/compensation")}?employee=${encodeURIComponent(e.employeeCode)}`}
                >
                  Compensation
                </Link>
              </td>
              <td>
                <Button
                  onClick={() =>
                    confirm(
                      `${e.status === "ACTIVE" ? "Deactivate" : "Activate"} ${e.employeeCode}?`,
                    ) &&
                    void updatePayrollEmployee(e.employeeCode, {
                      status: e.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                    })
                      .then(load)
                      .catch((x) => setError((x as Error).message))
                  }
                >
                  {e.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Empty>No payroll employees. Configure an employee to begin.</Empty>
      )}
    </Page>
  );
}
function PayrollDashboard({ employeeCount }: { employeeCount: number }) {
  const steps = [
    [
      "1",
      "Salary templates",
      "Define reusable earning and deduction configurations.",
      "salary-templates",
    ],
    [
      "2",
      "Compensation",
      "Review immutable employee compensation snapshots.",
      "compensation",
    ],
    [
      "3",
      "Calculations",
      "Preview payroll results using active compensation.",
      "calculations",
    ],
    [
      "4",
      "Pay runs",
      "Include employees, process, and finalize payroll.",
      "pay-runs",
    ],
    ["5", "Ledger", "Review finalized signed payroll history.", "ledger"],
    ["6", "Payslips", "View finalized employee payroll documents.", "payslips"],
  ];
  return (
    <Page
      title="Payroll dashboard"
      description={`${employeeCount} payroll employee${employeeCount === 1 ? "" : "s"} configured. Follow the workflow from configuration to finalized history.`}
    >
      <div className="workflow">
        {steps.map(([number, title, description, path]) => (
          <Link
            className="workflow-step"
            key={path}
            to={appPath(`/app/payroll/${path}`)}
          >
            <span>{number}</span>
            <div>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </Page>
  );
}
function EmployeeForm({ reload }: { reload(): Promise<void> }) {
  return (
    <details className="card">
      <summary>Configure employee</summary>
      <form
        className="form-grid"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          const b = Object.fromEntries(
            new FormData(e.currentTarget as HTMLFormElement),
          );
          void createPayrollEmployee({ ...b, status: "ACTIVE" }).then(reload);
        }}
      >
        {input("employeeCode")}
        {input("currency", "USD")}
        <label>
          Frequency
          <select name="payFrequency">
            <option>MONTHLY</option>
            <option>BIWEEKLY</option>
            <option>WEEKLY</option>
          </select>
        </label>
        {input("effectiveFrom", "", "date")}
        <Button variant="primary">Create</Button>
      </form>
    </details>
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
    <Page title="Components">
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
            <td>{c.category}</td>
            <td>{c.amountType}</td>
            <td>{c.occurrenceType}</td>
            <td>
              <Badge label={c.status} />
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
            {input("currency", "USD")}
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
  const [code, setCode] = useState(""),
    [data, setData] = useState<
      Profile[] | Calculation[] | LedgerEntry[] | Payslip[] | null
    >(null),
    [employee, setEmployee] = useState<PayrollEmployee | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const load = async (filters: Record<string, string> = {}) => {
    setError("");
    setLoading(true);
    try {
      const [records, payrollEmployee] = await Promise.all([
        section === "compensation"
          ? getProfiles(code)
          : section === "calculations"
            ? getCalculations(code)
            : section === "ledger"
              ? getLedger(code, filters)
              : getPayslips(code),
        getPayrollEmployee(code),
      ]);
      setData(records);
      setEmployee(payrollEmployee);
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setLoading(false);
    }
  };
  const title =
    section === "compensation"
      ? "Compensation"
      : section === "calculations"
        ? "Calculations"
        : section === "ledger"
          ? "Payroll Ledger"
          : "Payslips";
  return (
    <Page
      title={title}
      description="Enter a public employee code to view workspace-scoped payroll history."
    >
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <input
          required
          placeholder="Employee code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <Button variant="primary" disabled={loading}>
          {loading ? "Loading…" : "Load employee"}
        </Button>
      </form>
      {error && <Notice>{error}</Notice>}
      {employee && (
        <div className="employee-context">
          <strong>{employee.employeeCode}</strong>
          <span>{employee.currency}</span>
          <span>{label(employee.payFrequency)}</span>
          <Badge label={employee.status} />
        </div>
      )}
      {section === "compensation" && <ProfileForm code={code} reload={load} />}{" "}
      {section === "calculations" && (
        <form
          className="toolbar"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            const date = String(
              new FormData(e.currentTarget as HTMLFormElement).get("date"),
            );
            void calculate(code, date)
              .then(() => load())
              .catch((x) => setError((x as Error).message));
          }}
        >
          <input type="date" name="date" required />
          <Button>Calculate</Button>
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
            void load(values);
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
      {data && data.length === 0 && <Empty>No records.</Empty>}
      {data &&
        section === "compensation" &&
        (data as Profile[]).map((p) => (
          <article className="card" key={p.profileKey}>
            <h3>
              {p.profileKey} <Badge label={p.status} />
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
              {p.currency} · {p.effectiveFrom} to {p.effectiveTo ?? "ongoing"}
            </p>
            <p className="snapshot-note">
              This profile is a historical compensation snapshot and is not
              edited from this view.
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
                  <td>{money(c.value, p.currency)}</td>
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
            <h3>{c.calculationDate}</h3>
            <p>
              Gross {c.grossAmount} · Deductions {c.deductionAmount} · Net{" "}
              {c.netAmount} {c.currency}
            </p>
            <div className="payslip-columns">
              <section>
                <h4>Earnings</h4>
                {c.lines.filter((line) => line.category === "EARNING").map((l) => (
                  <p key={l.componentKey}>
                    {l.displayName}: {l.calculatedAmount}{l.percentageBasis ? ` (${label(l.percentageBasis)})` : ""}
                  </p>
                ))}
              </section>
              <section>
                <h4>Deductions</h4>
                {c.lines.filter((line) => line.category === "DEDUCTION").map((l) => (
                  <p key={l.componentKey}>
                    {l.displayName}: {l.calculatedAmount}{l.percentageBasis ? ` (${label(l.percentageBasis)})` : ""}
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
              <td>{e.entryDate}</td>
              <td>
                {e.periodStart} – {e.periodEnd}
              </td>
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
                <small>FINALIZED PAYSLIP</small>
                <h3>{p.employeeCode}</h3>
                <p>Pay run {p.payRunKey}</p>
              </div>
              <Badge label="FINALIZED" />
            </header>
            <dl>
              <div>
                <dt>Pay period</dt>
                <dd>
                  {p.periodStart} – {p.periodEnd}
                </dd>
              </div>
              <div>
                <dt>Calculation date</dt>
                <dd>{p.calculationDate}</dd>
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
function ProfileForm({
  code,
  reload,
}: {
  code: string;
  reload(): Promise<void>;
}) {
  return (
    <details className="card">
      <summary>Create compensation profile</summary>
      <form
        className="form-grid"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget as HTMLFormElement);
          const body = {
            profileKey: f.get("profileKey"),
            currency: f.get("currency"),
            effectiveFrom: f.get("effectiveFrom"),
            effectiveTo: f.get("effectiveTo") || null,
            status: "ACTIVE",
            components: [
              {
                componentKey: f.get("componentKey"),
                value: Number(f.get("value")),
              },
            ],
          };
          void createProfile(code, body).then(reload);
        }}
      >
        {input("profileKey")}
        {input("currency", "USD")}
        {input("effectiveFrom", "", "date")}
        {input("effectiveTo", "", "date")}
        {input("componentKey")}
        {input("value", "0", "number")}
        <Button variant="primary" disabled={!code}>
          Create
        </Button>
      </form>
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
    [busy, setBusy] = useState(false);
  const [view, setView] = useState(page);
  useEffect(() => setView(page), [page]);
  const runs = view.content;
  const open = async (r: PayRun) => {
    setSelected(r);
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
      setError(x instanceof ApiError ? x.message : "Unable to update Pay Run");
      await reload();
    } finally {
      setBusy(false);
    }
  };
  const goToPage = async (next: number) => {
    setBusy(true);
    try { setView(await getPayRuns(next)); }
    catch (x) { setError(x instanceof ApiError ? x.message : "Unable to load Pay Runs"); }
    finally { setBusy(false); }
  };
  return (
    <Page title="Pay Runs">
      <details className="card">
        <summary>Create pay run</summary>
        <form
          className="form-grid"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            setBusy(true);
            void createPayRun(
              Object.fromEntries(
                new FormData(e.currentTarget as HTMLFormElement),
              ),
            ).then(reload).catch((x) => setError(x instanceof ApiError ? x.message : "Unable to create Pay Run")).finally(() => setBusy(false));
          }}
        >
          {input("payRunKey")}
          {input("periodStart", "", "date")}
          {input("periodEnd", "", "date")}
          {input("calculationDate", "", "date")}
          {input("currency", "USD")}
          <Button variant="primary" disabled={busy}>{busy ? "Creating…" : "Create"}</Button>
        </form>
      </details>
      {error && <Notice>{error}</Notice>}
      {!runs.length ? (
        <Empty>No pay runs. Create a draft pay run to begin processing.</Empty>
      ) : (
        <Table
          headers={[
            "Run",
            "Period",
            "Status",
            "Employees",
            "Gross",
            "Net",
            "Action",
          ]}
        >
          {runs.map((r) => (
            <tr key={r.payRunKey}>
              <td>{r.payRunKey}</td>
              <td>
                {r.periodStart} – {r.periodEnd}
              </td>
              <td>
                <Badge label={r.status} />
              </td>
              <td>{r.employeeCount}</td>
              <td>
                {r.grossTotal} {r.currency}
              </td>
              <td>{r.netTotal}</td>
              <td>
                <Button onClick={() => void open(r)}>Open</Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
      {selected && (
        <article className="card">
          <div className="card-heading">
            <div>
              <h3>
                {selected.payRunKey} <Badge label={selected.status} />
              </h3>
              <p className="snapshot-note">{payRunGuidance(selected.status)}</p>
            </div>
          </div>
          {selected.status === "DRAFT" && (
            <form
              className="toolbar"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                const code = String(
                  new FormData(e.currentTarget as HTMLFormElement).get(
                    "employeeCode",
                  ),
                );
                setBusy(true);
                void addPayRunEmployee(selected.payRunKey, code)
                  .then(() => open(selected))
                  .catch((x) => setError(x instanceof ApiError ? x.message : "Unable to include employee"))
                  .finally(() => setBusy(false));
              }}
            >
              <input name="employeeCode" placeholder="Employee code" required />
              <Button disabled={busy}>Add employee</Button>
            </form>
          )}
          {employees.length ? (
            <Table
              headers={[
                "Employee",
                "Gross",
                "Deductions",
                "Net",
                "Calculation date",
              ]}
            >
              {employees.map((e) => (
                <tr key={e.employeeCode}>
                  <td>{e.employeeCode}</td>
                  <td>{money(e.grossAmount, e.currency)}</td>
                  <td>{money(e.deductionAmount, e.currency)}</td>
                  <td>{money(e.netAmount, e.currency)}</td>
                  <td>{e.calculationDate}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty>No employees have been included in this pay run.</Empty>
          )}
          <div className="toolbar">
            {selected.status === "DRAFT" && (
              <Button
                disabled={busy || !employees.length}
                onClick={() =>
                  confirm("Process this pay run?") &&
                  void mutate(() => processPayRun(selected.payRunKey))
                }
              >
                Process
              </Button>
            )}
            {selected.status === "CALCULATED" && (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  confirm("Finalize this pay run?") &&
                  void mutate(() => finalizePayRun(selected.payRunKey))
                }
              >
                Finalize
              </Button>
            )}
            {selected.status === "FINALIZED" && (
              <Notice tone="success">
                Finalized payroll is immutable. Use Employee Ledger or Payslips
                to review the resulting history.
              </Notice>
            )}
            {selected.status === "PROCESSING" && (
              <Button disabled={busy} onClick={() => void mutate(() => getPayRun(selected.payRunKey))}>Refresh processing state</Button>
            )}
            {selected.status === "FAILED" && (
              <Notice>Processing failed. Review the API error and correct the Pay Run before creating a new run.</Notice>
            )}
          </div>
        </article>
      )}
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
const money = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
    value,
  );
const payRunGuidance = (status: string) =>
  status === "DRAFT"
    ? "Add employees, then process the run. Draft membership is editable."
    : status === "PROCESSING"
      ? "Payroll calculations are currently being processed."
      : status === "CALCULATED"
        ? "Calculations are complete. Review employee totals before finalizing."
        : status === "FINALIZED"
          ? "Finalization is complete and ledger/payslip snapshots are immutable."
          : "Processing failed. Review the reported error before trying again.";
