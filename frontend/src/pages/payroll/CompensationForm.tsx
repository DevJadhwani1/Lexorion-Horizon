import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../../api/types";
import { Button } from "../../components/ui/Button";
import { Notice } from "../../components/ui/Page";
import { Field } from "../../components/ui/Field";
import { createComponent, createProfile, getComponents, type Component, type PayrollEmployee, type Profile } from "../../features/payroll/payrollApi";
import { formatMoney, humanize } from "../../lib/format";

type Values = Record<string, string>;

/**
 * Estimates recurring pay for one period with the same order the Payroll calculator uses:
 * percentage earnings apply to fixed earnings, percentage deductions apply to gross pay.
 * One-time components and server rounding are excluded, so this is an estimate, not a calculation.
 */
export function estimatePay(components: Component[], values: Values) {
  let fixedEarnings = 0, earningPercent = 0, fixedDeductions = 0, deductionPercent = 0;
  for (const component of components) {
    const raw = values[component.componentKey];
    if (raw === undefined || raw === "" || component.occurrenceType !== "RECURRING") continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    if (component.category === "EARNING") { if (component.amountType === "PERCENTAGE") earningPercent += value; else fixedEarnings += value; }
    else if (component.amountType === "PERCENTAGE") deductionPercent += value; else fixedDeductions += value;
  }
  const gross = fixedEarnings + fixedEarnings * earningPercent / 100;
  const deductions = fixedDeductions + gross * deductionPercent / 100;
  return { gross, deductions, net: gross - deductions };
}

/** Builds a profile key that does not collide with the employee's existing profiles (`SAL-20261001`, `SAL-20261001-2`). */
export function nextProfileKey(effectiveFrom: string, existing: Profile[]): string {
  const base = `SAL-${(effectiveFrom || "START").replaceAll("-", "")}`;
  const taken = new Set(existing.map((profile) => profile.profileKey.toUpperCase()));
  let key = base, suffix = 2;
  while (taken.has(key)) key = `${base}-${suffix++}`;
  return key;
}

const starter = { componentKey: "BASIC", displayName: "Basic salary", category: "EARNING", amountType: "FIXED_AMOUNT", occurrenceType: "RECURRING", taxability: "TAXABLE", status: "ACTIVE" };

/** Creates an employee's compensation profile by choosing pay components and amounts. */
export function CompensationForm({ employee, profiles, onSaved, submitLabel = "Save salary", locale }: {
  employee: PayrollEmployee; profiles: Profile[]; onSaved(profile: Profile): void | Promise<void>; submitLabel?: string; locale?: string;
}) {
  const [components, setComponents] = useState<Component[] | null>(null);
  const [values, setValues] = useState<Values>({});
  const [effectiveFrom, setEffectiveFrom] = useState(() => defaultStart(employee, profiles));
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const loadComponents = () => getComponents()
    .then((items) => setComponents(items.filter((item) => item.status === "ACTIVE")))
    .catch((reason) => { setComponents([]); setError(reason instanceof ApiError ? reason.message : "Unable to load pay components"); });
  useEffect(() => { void loadComponents(); }, []);
  const chosen = (components ?? []).filter((component) => values[component.componentKey] !== undefined);
  const estimate = estimatePay(components ?? [], values);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!chosen.length) { setError("Choose at least one pay component."); return; }
    setBusy(true);
    void createProfile(employee.employeeCode, {
      profileKey: nextProfileKey(effectiveFrom, profiles),
      currency: employee.currency,
      effectiveFrom,
      effectiveTo: null,
      status: "ACTIVE",
      components: chosen.map((component) => ({ componentKey: component.componentKey, value: Number(values[component.componentKey] || 0) })),
    }).then(onSaved)
      .catch((reason) => setError(reason instanceof ApiError ? explain(reason.message) : "Unable to save salary"))
      .finally(() => setBusy(false));
  };
  if (components === null) return <p role="status">Loading pay components…</p>;
  return <form className="salary-form" aria-label="Salary" onSubmit={submit}>
    {error && <Notice>{error}</Notice>}
    <div className="form-grid">
      <Field label="Salary starts on" hint="Use the first day of a pay period. Payroll does not pro-rate partial periods.">
        <input type="date" required value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
      </Field>
      <Field label="Currency" hint="From the employee’s payroll settings."><input value={employee.currency} readOnly aria-readonly="true" /></Field>
      <label>Pay frequency<input value={humanize(employee.payFrequency)} readOnly aria-readonly="true" /></label>
    </div>
    {components.length === 0 ? <Notice tone="info">
      <p>No pay components exist yet. Most organizations start with a basic salary.</p>
      <Button type="button" variant="primary" disabled={busy} onClick={() => {
        setBusy(true); setError("");
        void createComponent(starter).then(loadComponents).then(() => setValues({ BASIC: "" }))
          .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Unable to create component"))
          .finally(() => setBusy(false));
      }}>Create “Basic salary” component</Button>
    </Notice> : <fieldset className="component-picker">
      <legend>Pay components</legend>
      {components.map((component) => {
        const selected = values[component.componentKey] !== undefined;
        const percent = component.amountType === "PERCENTAGE";
        return <div className="component-choice" key={component.componentKey}>
          <input type="checkbox" id={`component-${component.componentKey}`} aria-describedby={`component-${component.componentKey}-detail`} checked={selected}
            onChange={(event) => setValues((current) => {
              const next = { ...current };
              if (event.target.checked) next[component.componentKey] = ""; else delete next[component.componentKey];
              return next;
            })} />
          <span>
            <label htmlFor={`component-${component.componentKey}`}><strong>{component.displayName}</strong></label>
            <small id={`component-${component.componentKey}-detail`}>{humanize(component.category)} · {percent ? (component.category === "EARNING" ? "% of fixed earnings" : "% of gross pay") : "Fixed amount"}{component.occurrenceType === "ONE_TIME" ? " · First period only" : ""}</small>
          </span>
          <input type="number" min="0" step="0.01" required={selected} disabled={!selected} aria-label={`${component.displayName} ${percent ? "percentage" : `amount in ${employee.currency}`}`}
            placeholder={percent ? "%" : employee.currency} value={values[component.componentKey] ?? ""}
            onChange={(event) => setValues((current) => ({ ...current, [component.componentKey]: event.target.value }))} />
        </div>;
      })}
    </fieldset>}
    {chosen.length > 0 && <dl className="pay-estimate" aria-label="Estimated pay">
      <div><dt>Gross</dt><dd>{formatMoney(estimate.gross, employee.currency, locale)}</dd></div>
      <div><dt>Deductions</dt><dd>{formatMoney(estimate.deductions, employee.currency, locale)}</dd></div>
      <div className="net"><dt>Net pay</dt><dd>{formatMoney(estimate.net, employee.currency, locale)}</dd></div>
      <p className="snapshot-note">Estimated recurring pay per {employee.payFrequency === "MONTHLY" ? "month" : employee.payFrequency === "WEEKLY" ? "week" : "two weeks"}. Excludes one-time components; statutory deductions are not calculated by Horizon.</p>
    </dl>}
    <div className="form-actions"><Button variant="primary" disabled={busy || components.length === 0}>{busy ? "Saving…" : submitLabel}</Button></div>
  </form>;
}

function defaultStart(employee: PayrollEmployee, profiles: Profile[]): string {
  const ended = profiles.map((profile) => profile.effectiveTo).filter((value): value is string => Boolean(value)).sort().at(-1);
  if (ended && ended >= employee.effectiveFrom) {
    const next = new Date(`${ended}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString().slice(0, 10);
  }
  return employee.effectiveFrom;
}

function explain(message: string): string {
  return /overlaps/i.test(message)
    ? `${message}. This employee already has a salary covering that date. Choose a start date after the current salary ends.`
    : message;
}
