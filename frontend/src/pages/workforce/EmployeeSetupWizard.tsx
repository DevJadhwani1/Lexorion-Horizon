import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/types";
import { appPath } from "../../app/hostRouting";
import { Button } from "../../components/ui/Button";
import { Notice, Page } from "../../components/ui/Page";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { createEmployee, getEmployee, type Employee } from "../../features/workforce/workforceApi";
import { getAllEmployees, useWorkforceDirectory } from "../../features/workforce/useWorkforceDirectory";
import { getPayrollSetup, getProfiles, type PayrollSetup, type Profile } from "../../features/payroll/payrollApi";
import { useOrganizationDefaults } from "../../features/organization/useOrganizationDefaults";
import { formatDate, humanize, personName } from "../../lib/format";
import { CompensationForm } from "../payroll/CompensationForm";
import { EMPLOYEE_CODE_PATTERN, EmployeeFields, employeeCodePrefix, suggestEmployeeCode } from "./EmployeeFields";
import { PayrollSetupStep, SectionStatusBadge } from "./PayrollSetupStep";
import { useAuth } from "../../auth/AuthProvider";

type Step = "details" | "payroll" | "salary" | "review";
interface Progress { employee: Employee | null; setup: PayrollSetup | null; profiles: Profile[] }

/**
 * Guided setup for a new employee: details → payroll setup → salary → review. Each step saves through the existing
 * service APIs as soon as it is completed, and `?employee=CODE` resumes at the first unfinished step. Every screen
 * after the first is rebuilt from saved server state, so skipping a step never shows it as done.
 */
export function EmployeeSetupWizard() {
  const [params, setParams] = useSearchParams();
  const code = params.get("employee")?.trim().toUpperCase() ?? "";
  const requestedStep = params.get("step") as Step | null;
  const workspace = useWorkspace().workspace;
  const payrollEnabled = Boolean(workspace?.products.some((product) => product.key === "payroll"));
  const directory = useWorkforceDirectory();
  const defaults = useOrganizationDefaults();
  const codePrefix = employeeCodePrefix(useAuth().organization?.organizationName ?? "", defaults.organizationCode);
  const [progress, setProgress] = useState<Progress>({ employee: null, setup: null, profiles: [] });
  const [step, setStep] = useState<Step>("details");
  const [loading, setLoading] = useState(Boolean(code)), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!code) { setProgress({ employee: null, setup: null, profiles: [] }); setStep("details"); setLoading(false); return; }
    let current = true;
    setLoading(true); setError("");
    (async () => {
      const employee = await getEmployee(code);
      let setup: PayrollSetup | null = null, profiles: Profile[] = [];
      if (payrollEnabled) {
        setup = await getPayrollSetup(code).catch((reason) => { if (reason instanceof ApiError && reason.status === 404) return null; throw reason; });
        if (setup) profiles = await getProfiles(code);
      }
      return { employee, setup, profiles };
    })().then((value) => {
      if (!current) return;
      setProgress(value);
      const next: Step = !payrollEnabled ? "review" : !value.setup ? "payroll" : value.setup.salaryConfigured ? "review" : "salary";
      const allowed: Step[] = payrollEnabled ? ["payroll", ...(value.setup && !value.setup.salaryConfigured ? ["salary" as Step] : []), "review"] : ["review"];
      setStep(requestedStep && allowed.includes(requestedStep) ? requestedStep : next);
    }).catch((reason) => { if (current) setError(reason instanceof ApiError ? reason.message : "Unable to load this employee’s setup."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [code, payrollEnabled, revision, requestedStep]);

  const steps: { key: Step; title: string }[] = [
    { key: "details", title: "Employee details" },
    ...(payrollEnabled ? [{ key: "payroll" as Step, title: "Payroll setup" }, { key: "salary" as Step, title: "Salary" }] : []),
    { key: "review", title: "Review" },
  ];
  const position = steps.findIndex((item) => item.key === step);
  const name = personName(progress.employee);
  // Changing the URL reloads saved progress; when it would not change, reload explicitly (exactly once either way).
  const go = (employeeCode: string, next?: Step) => {
    if (employeeCode === code && (next ?? null) === requestedStep) setRevision((value) => value + 1);
    else setParams(next ? { employee: employeeCode, step: next } : { employee: employeeCode }, { replace: true });
  };

  return <Page title={name ? `Set up ${name}` : "Add employee"} description="Add the person, set up payroll, build their salary, then review. Each step is saved as you go — you can leave and resume from the employee’s profile.">
    <ol className="stepper" aria-label="Setup progress">
      {steps.map((item, index) => <li key={item.key} className={index < position ? "done" : index === position ? "current" : ""} aria-current={index === position ? "step" : undefined}>
        <span aria-hidden="true">{index < position ? "✓" : index + 1}</span>{item.title}
      </li>)}
    </ol>
    {error && <Notice>{error}<p><Button size="sm" onClick={() => setRevision((value) => value + 1)}>Try again</Button></p></Notice>}
    {loading ? <p role="status">Loading setup progress…</p> : <section className="card wizard-step">
      {step === "details" && <DetailsStep key={directory.loading || !defaults.loaded ? "loading" : `ready:${codePrefix}`} prefix={codePrefix}
        existingCodes={directory.employees.map((item) => item.employeeCode)} directory={directory} ready={!directory.loading && defaults.loaded}
        busy={busy} setBusy={setBusy} payrollEnabled={payrollEnabled}
        onCreated={async (created) => { await directory.reload(); go(created.employeeCode); }} />}

      {step === "payroll" && progress.employee && <PayrollSetupStep employee={progress.employee} setup={progress.setup} defaultCurrency={defaults.currency}
        onSaved={() => go(progress.employee!.employeeCode, "salary")}
        onFinishLater={() => go(progress.employee!.employeeCode, "review")}
        onSkip={() => setStep("review")} />}

      {step === "salary" && progress.setup && <div>
        <h2>Salary for {name}</h2>
        <p className="snapshot-note">Add each pay component {progress.employee?.firstName} receives each {progress.setup.enrollment.payFrequency === "MONTHLY" ? "month" : "pay period"}. The breakdown updates as you go.</p>
        <CompensationForm employee={progress.setup.enrollment} profiles={progress.profiles} locale={defaults.locale} submitLabel="Save salary and review"
          onSaved={() => go(progress.employee!.employeeCode, "review")} />
        <div className="form-actions"><Button type="button" onClick={() => setStep("review")}>Skip salary for now</Button></div>
      </div>}

      {step === "review" && progress.employee && <Review employee={progress.employee} setup={progress.setup} payrollEnabled={payrollEnabled}
        onEdit={(next) => setStep(next)} />}
    </section>}
  </Page>;
}

function DetailsStep({ prefix, existingCodes, directory, ready, busy, setBusy, payrollEnabled, onCreated }: {
  prefix: string; existingCodes: string[]; directory: ReturnType<typeof useWorkforceDirectory>; ready: boolean;
  busy: boolean; setBusy(value: boolean): void; payrollEnabled: boolean; onCreated(employee: Employee): Promise<void>;
}) {
  const [suggestion, setSuggestion] = useState(() => suggestEmployeeCode(existingCodes, prefix));
  const [code, setCode] = useState(suggestion);
  const [codeError, setCodeError] = useState(""), [error, setError] = useState("");
  const edited = code !== suggestion;
  const takenBy = directory.employees.find((item) => item.employeeCode.toUpperCase() === code.toUpperCase());
  const inlineError = codeError || (takenBy ? `${code} is already used by ${personName(takenBy)}${takenBy.status === "RESIGNED" || takenBy.status === "TERMINATED" ? " (no longer employed)" : ""}.` : "");
  return <form aria-label="Employee details" noValidate={false} onSubmit={(event: FormEvent) => {
    event.preventDefault();
    if (inlineError || !EMPLOYEE_CODE_PATTERN.test(code)) return;
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const body: Record<string, unknown> = Object.fromEntries(Array.from(form.entries()).filter(([, value]) => value !== ""));
    if (!body.phone) delete body.phoneCountry;
    setBusy(true); setError(""); setCodeError("");
    void createWithCode(body, code, edited, prefix)
      .then(onCreated)
      .catch((reason) => {
        if (reason instanceof CodeTaken) { setSuggestion(reason.suggestion); setCodeError(`${reason.code} was just taken. Use ${reason.suggestion} or enter another code.`); return; }
        setError(reason instanceof ApiError ? reason.message : "Unable to save employee details.");
      })
      .finally(() => setBusy(false));
  }}>
    <h2>Employee details</h2>
    {error && <Notice>{error}</Notice>}
    <EmployeeFields code={{ value: code, suggestion, onChange: (value) => { setCode(value); setCodeError(""); }, error: inlineError }}
      departments={directory.departments} designations={directory.designations} managers={directory.employees} />
    <div className="form-actions"><Button variant="primary" disabled={busy || !ready}>{busy ? "Saving…" : payrollEnabled ? "Save and continue" : "Save employee"}</Button></div>
  </form>;
}

function Review({ employee, setup, payrollEnabled, onEdit }: { employee: Employee; setup: PayrollSetup | null; payrollEnabled: boolean; onEdit(step: Step): void }) {
  const name = personName(employee);
  const ready = Boolean(setup?.readiness.readyForPayroll && setup.readiness.setupComplete);
  const heading = !payrollEnabled ? "Employee created"
    : ready ? "Ready for payroll"
      : setup?.salaryConfigured ? "Salary configured · payroll setup incomplete" : "Employee created · payroll setup incomplete";
  const profile = appPath(`/workforce/employees/${encodeURIComponent(employee.employeeCode)}`);
  return <div aria-label="Setup review">
    <h2>{name}: {heading}</h2>
    <ul className="setup-summary review-list">
      <li className="done">
        <span><strong>Employee record</strong> · {employee.employeeCode} · {employee.employmentType ? `${humanize(employee.employmentType)} · ` : ""}joined {formatDate(employee.joiningDate)}</span>
        <Link to={profile}>Edit</Link>
      </li>
      {payrollEnabled && !setup && <li className="todo"><span><strong>Payroll</strong> · Not set up — {employee.firstName} cannot be paid yet.</span><Button size="sm" onClick={() => onEdit("payroll")}>Set up payroll</Button></li>}
      {setup && setup.sections.filter((section) => section.key !== "salary").map((section) => <li key={section.key} className={section.status === "COMPLETE" || section.status === "NOT_APPLICABLE" ? "done" : "todo"}>
        <span><strong>{section.title}</strong> <SectionStatusBadge status={section.status} />{section.missing.length > 0 && section.status !== "NOT_STARTED" && <small> Still needed: {section.missing.join(", ")}</small>}{section.note && <small> {section.note}</small>}</span>
        <Button size="sm" aria-label={`Edit ${section.title}`} onClick={() => onEdit("payroll")}>Edit</Button>
      </li>)}
      {setup && <li className={setup.salaryConfigured ? "done" : "todo"}>
        <span><strong>Salary</strong> <SectionStatusBadge status={setup.salaryConfigured ? "COMPLETE" : "NOT_STARTED"} />{!setup.salaryConfigured && <small> Blocks pay runs until added.</small>}</span>
        {setup.salaryConfigured
          ? <Link to={`${appPath("/payroll/compensation")}?employee=${encodeURIComponent(employee.employeeCode)}`}>View salary</Link>
          : <Button size="sm" onClick={() => onEdit("salary")}>Add salary</Button>}
      </li>}
    </ul>
    {setup && setup.readiness.blockers.length > 0 && <Notice tone="info"><strong>Before {employee.firstName} can be included in a pay run:</strong><ul>{setup.readiness.blockers.map((item) => <li key={item}>{item}</li>)}</ul></Notice>}
    {setup && setup.readiness.readyForPayroll && !setup.readiness.setupComplete && <p className="snapshot-note">{employee.firstName} can be included in pay runs, but the payroll details marked above are still incomplete or unverified.</p>}
    <div className="form-actions">
      <Link className="button secondary" to={profile}>View profile</Link>
      <Link className="button secondary" to={appPath("/workforce/employees/new")}>Add another employee</Link>
      {setup?.readiness.readyForPayroll && <Link className="button primary" to={appPath("/payroll/runs")}>Go to pay runs</Link>}
    </div>
  </div>;
}

class CodeTaken extends Error {
  constructor(readonly code: string, readonly suggestion: string) { super(`${code} is already used`); }
}

const same = (a: unknown, b: unknown) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

/**
 * Creates the employee without ever creating two records for one submission. On a code conflict the existing
 * record is checked first: if it is this same person (an earlier attempt whose response was lost), it is reused.
 * Otherwise an untouched suggestion moves to the next free code; a code the admin typed is reported instead.
 */
async function createWithCode(body: Record<string, unknown>, initial: string, edited: boolean, prefix: string): Promise<Employee> {
  let employeeCode = initial;
  for (let attempt = 1; ; attempt++) {
    try {
      return await createEmployee({ ...body, employeeCode, status: body.status ?? "ACTIVE" });
    } catch (reason) {
      if (!(reason instanceof ApiError && reason.status === 409 && /code/i.test(reason.message))) throw reason;
      const existing = await getEmployee(employeeCode).catch(() => null);
      if (existing && same(existing.workEmail, body.workEmail) && same(existing.firstName, body.firstName) && same(existing.lastName, body.lastName)) return existing;
      const next = suggestEmployeeCode((await getAllEmployees()).map((item) => item.employeeCode), prefix);
      if (edited || attempt >= 3) throw new CodeTaken(employeeCode, next);
      employeeCode = next;
    }
  }
}
