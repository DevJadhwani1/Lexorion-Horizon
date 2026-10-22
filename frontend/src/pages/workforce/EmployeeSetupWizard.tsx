import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/types";
import { appPath } from "../../app/hostRouting";
import { Button } from "../../components/ui/Button";
import { Notice, Page } from "../../components/ui/Page";
import { Field } from "../../components/ui/Field";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { createEmployee, getEmployee, type Employee } from "../../features/workforce/workforceApi";
import { useWorkforceDirectory } from "../../features/workforce/useWorkforceDirectory";
import { createPayrollEmployee, getPayrollEmployee, getProfiles, type PayrollEmployee, type Profile } from "../../features/payroll/payrollApi";
import { useOrganizationDefaults } from "../../features/organization/useOrganizationDefaults";
import { formatDate, humanize, personName } from "../../lib/format";
import { CompensationForm } from "../payroll/CompensationForm";
import { EmployeeFields, employeeCodePrefix, suggestEmployeeCode } from "./EmployeeFields";
import { useAuth } from "../../auth/AuthProvider";

type Step = "details" | "payroll" | "salary" | "done";
interface Progress { employee: Employee | null; payroll: PayrollEmployee | null; profiles: Profile[] }

/**
 * Guided setup for a new employee: Workforce record → Payroll enrollment → salary. Each step saves through the
 * existing service API as soon as it is completed, and `?employee=CODE` resumes the first unfinished step.
 * Existing records are always reloaded before a step is offered, so the wizard never creates a second record.
 */
export function EmployeeSetupWizard() {
  const [params, setParams] = useSearchParams();
  const code = params.get("employee")?.trim().toUpperCase() ?? "";
  const workspace = useWorkspace().workspace;
  const payrollEnabled = Boolean(workspace?.products.some((product) => product.key === "payroll"));
  const directory = useWorkforceDirectory();
  const defaults = useOrganizationDefaults();
  const codePrefix = employeeCodePrefix(useAuth().organization?.organizationName ?? "", defaults.organizationCode);
  const [progress, setProgress] = useState<Progress>({ employee: null, payroll: null, profiles: [] });
  const [step, setStep] = useState<Step>("details");
  const [loading, setLoading] = useState(Boolean(code)), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!code) { setProgress({ employee: null, payroll: null, profiles: [] }); setStep("details"); setLoading(false); return; }
    let current = true;
    setLoading(true); setError("");
    (async () => {
      const employee = await getEmployee(code);
      let payroll: PayrollEmployee | null = null, profiles: Profile[] = [];
      if (payrollEnabled) {
        payroll = await getPayrollEmployee(code, { expectMissing: true }).catch((reason) => { if (reason instanceof ApiError && reason.status === 404) return null; throw reason; });
        if (payroll) profiles = await getProfiles(code);
      }
      return { employee, payroll, profiles };
    })().then((value) => {
      if (!current) return;
      setProgress(value);
      setStep(!payrollEnabled ? "done" : !value.payroll ? "payroll" : hasSalary(value.profiles) ? "done" : "salary");
    }).catch((reason) => { if (current) setError(reason instanceof ApiError ? reason.message : "Unable to load this employee’s setup."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [code, payrollEnabled, revision]);

  const steps: { key: Step; title: string }[] = [
    { key: "details", title: "Employee details" },
    ...(payrollEnabled ? [{ key: "payroll" as Step, title: "Payroll settings" }, { key: "salary" as Step, title: "Salary" }] : []),
    { key: "done", title: "Done" },
  ];
  const position = steps.findIndex((item) => item.key === step);
  const name = personName(progress.employee);
  const resume = (employeeCode: string) => setParams({ employee: employeeCode }, { replace: true });

  return <Page title={name ? `Set up ${name}` : "Add employee"} description="Add the person, set how they are paid, then give them a salary. Each step is saved as you go — you can leave and resume from the employee’s profile.">
    <ol className="stepper" aria-label="Setup progress">
      {steps.map((item, index) => <li key={item.key} className={index < position ? "done" : index === position ? "current" : ""} aria-current={index === position ? "step" : undefined}>
        <span>{index < position ? "✓" : index + 1}</span>{item.title}
      </li>)}
    </ol>
    {error && <Notice>{error}<p><Button size="sm" onClick={() => setRevision((value) => value + 1)}>Try again</Button></p></Notice>}
    {loading ? <p role="status">Loading setup progress…</p> : <section className="card wizard-step">
      {step === "details" && <form aria-label="Employee details" onSubmit={(event: FormEvent) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget as HTMLFormElement);
        const body = Object.fromEntries(Array.from(form.entries()).filter(([, value]) => value !== ""));
        const employeeCode = String(body.employeeCode ?? "").trim().toUpperCase();
        setBusy(true); setError("");
        void createEmployee({ ...body, employeeCode, status: "ACTIVE" })
          .then(async (created) => { await directory.reload(); resume(created.employeeCode); })
          .catch((reason) => setError(reason instanceof ApiError && reason.status === 409 && /code/i.test(reason.message)
            ? `Employee code ${employeeCode} is already in use. Choose another code, or continue setting up that employee from their profile.`
            : reason instanceof ApiError ? reason.message : "Unable to save employee details."))
          .finally(() => setBusy(false));
      }}>
        <h2>Employee details</h2>
        <div className="form-grid">
          <EmployeeFields includeCode suggestedCode={suggestEmployeeCode(directory.employees.map((item) => item.employeeCode), codePrefix)}
            key={directory.loading || !defaults.loaded ? "loading" : `ready:${codePrefix}`}
            departments={directory.departments} designations={directory.designations} managers={directory.employees} />
        </div>
        <p className="snapshot-note">Department, designation and manager are optional. You can add them later.</p>
        <div className="form-actions"><Button variant="primary" disabled={busy || directory.loading || !defaults.loaded}>{busy ? "Saving…" : payrollEnabled ? "Save and continue" : "Save employee"}</Button></div>
      </form>}

      {step === "payroll" && progress.employee && <form aria-label="Payroll settings" onSubmit={(event: FormEvent) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget as HTMLFormElement);
        setBusy(true); setError("");
        void createPayrollEmployee({ employeeCode: progress.employee!.employeeCode, status: "ACTIVE", currency: String(form.get("currency")).toUpperCase(), payFrequency: form.get("payFrequency"), effectiveFrom: form.get("effectiveFrom") })
          .then(() => setRevision((value) => value + 1))
          // A 409 means enrollment already exists (for example, saved in another tab). Reload instead of failing.
          .catch((reason) => reason instanceof ApiError && reason.status === 409 && /already exists/i.test(reason.message)
            ? setRevision((value) => value + 1)
            : setError(reason instanceof ApiError ? reason.message : "Unable to save payroll settings."))
          .finally(() => setBusy(false));
      }}>
        <h2>Payroll settings for {name}</h2>
        <p className="snapshot-note">How and from when {progress.employee.firstName} is paid. The employee record is reused — nothing is entered twice.</p>
        <div className="form-grid">
          <Field label="Currency" hint={defaults.currency ? "Your organization’s currency." : "Three-letter currency code."}>
            <input name="currency" required pattern="[A-Za-z]{3}" maxLength={3} defaultValue={defaults.currency} key={defaults.currency} placeholder="e.g. INR" />
          </Field>
          <label>Pay frequency
            <select name="payFrequency" defaultValue="MONTHLY">
              <option value="MONTHLY">Monthly</option>
              <option value="BIWEEKLY">Every two weeks</option>
              <option value="WEEKLY">Weekly</option>
            </select>
          </label>
          <Field label="Payroll start date" hint={`Joined ${formatDate(progress.employee.joiningDate)}.`}>
            <input name="effectiveFrom" type="date" required defaultValue={progress.employee.joiningDate} />
          </Field>
        </div>
        <div className="form-actions">
          <Button variant="primary" disabled={busy}>{busy ? "Saving…" : "Save and continue"}</Button>
          <Button type="button" onClick={() => setStep("done")}>Skip payroll for now</Button>
        </div>
      </form>}

      {step === "salary" && progress.payroll && <div>
        <h2>Salary for {name}</h2>
        <p className="snapshot-note">Choose the pay components {progress.employee?.firstName} receives each {progress.payroll.payFrequency === "MONTHLY" ? "month" : "pay period"}.</p>
        <CompensationForm employee={progress.payroll} profiles={progress.profiles} locale={defaults.locale} submitLabel="Save salary and finish"
          onSaved={() => setRevision((value) => value + 1)} />
        <div className="form-actions"><Button type="button" onClick={() => setStep("done")}>Skip salary for now</Button></div>
      </div>}

      {step === "done" && progress.employee && <div aria-label="Setup summary">
        <h2>{name} is {payrollEnabled && (!progress.payroll || !hasSalary(progress.profiles)) ? "added" : "ready"}</h2>
        <ul className="setup-summary">
          <li className="done">Employee record · {progress.employee.employeeCode} · joined {formatDate(progress.employee.joiningDate)}</li>
          {payrollEnabled && <li className={progress.payroll ? "done" : "todo"}>{progress.payroll ? `Payroll · ${humanize(progress.payroll.payFrequency)} in ${progress.payroll.currency} from ${formatDate(progress.payroll.effectiveFrom)}` : "Payroll settings not set — this person cannot be paid yet."}</li>}
          {payrollEnabled && <li className={hasSalary(progress.profiles) ? "done" : "todo"}>{hasSalary(progress.profiles) ? "Salary configured" : "No salary yet — this person will be blocked from pay runs."}</li>}
        </ul>
        <div className="form-actions">
          {payrollEnabled && (!progress.payroll || !hasSalary(progress.profiles)) && <Button variant="primary" onClick={() => setStep(progress.payroll ? "salary" : "payroll")}>Finish payroll setup</Button>}
          <Link className="button secondary" to={appPath(`/app/workforce/employees/${progress.employee.employeeCode}`)}>View profile</Link>
          <Link className="button secondary" to={appPath("/app/workforce/employees/new")}>Add another employee</Link>
          {payrollEnabled && hasSalary(progress.profiles) && <Link className="button secondary" to={appPath("/app/payroll/pay-runs")}>Go to pay runs</Link>}
        </div>
      </div>}
    </section>}
  </Page>;
}

function hasSalary(profiles: Profile[]): boolean {
  return profiles.some((profile) => profile.status === "ACTIVE" && profile.components.length > 0);
}
