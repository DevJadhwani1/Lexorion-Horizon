import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ApiError } from "../../api/types";
import { Button } from "../../components/ui/Button";
import { Notice } from "../../components/ui/Page";
import { Field } from "../../components/ui/Field";
import { Dropdown } from "../../components/ui/Dropdown";
import { SearchSelect, type SelectOption } from "../../components/ui/SearchSelect";
import {
  createComponent, createProfile, getComponents, getStatutoryEstimate,
  type Component, type ComponentCategory, type PayrollEmployee, type Profile, type StatutoryEstimate,
} from "../../features/payroll/payrollApi";
import { formatDate, formatMoney, humanize } from "../../lib/format";

type Values = Record<string, string>;

/**
 * Estimates recurring pay for one period in the order the Payroll calculator uses: percentage earnings apply to
 * fixed earnings; percentage deductions and employer contributions apply to gross pay. Employer contributions
 * never reduce net pay. One-time components and server rounding are excluded, so this is an estimate.
 */
export function estimatePay(components: Component[], values: Values) {
  let fixedEarnings = 0, earningPercent = 0, fixedDeductions = 0, deductionPercent = 0, fixedEmployer = 0, employerPercent = 0;
  for (const component of components) {
    const raw = values[component.componentKey];
    if (raw === undefined || raw === "" || component.occurrenceType !== "RECURRING") continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    const percent = component.amountType === "PERCENTAGE";
    if (component.category === "EARNING") { if (percent) earningPercent += value; else fixedEarnings += value; }
    else if (component.category === "EMPLOYER_CONTRIBUTION") { if (percent) employerPercent += value; else fixedEmployer += value; }
    else if (percent) deductionPercent += value; else fixedDeductions += value;
  }
  const gross = fixedEarnings + fixedEarnings * earningPercent / 100;
  const deductions = fixedDeductions + gross * deductionPercent / 100;
  const employer = fixedEmployer + gross * employerPercent / 100;
  return { gross, deductions, net: gross - deductions, employer, employerCost: gross + employer };
}

/** Builds a profile key that does not collide with the employee's existing profiles (`SAL-20261001`, `SAL-20261001-2`). */
export function nextProfileKey(effectiveFrom: string, existing: Profile[]): string {
  const base = `SAL-${(effectiveFrom || "START").replaceAll("-", "")}`;
  const taken = new Set(existing.map((profile) => profile.profileKey.toUpperCase()));
  let key = base, suffix = 2;
  while (taken.has(key)) key = `${base}-${suffix++}`;
  return key;
}

/** Payroll component keys: an upper-case letter, then letters, digits or underscores. */
export function componentKeyFromName(name: string): string {
  const key = name.toUpperCase().normalize("NFKD").replaceAll(/[^A-Z0-9]+/g, "_").replaceAll(/^_+|_+$/g, "").slice(0, 60);
  return /^[A-Z]/.test(key) ? key : `C_${key}`.replace(/_$/, "");
}

interface Draft { displayName: string; category: ComponentCategory; amountType: Component["amountType"]; occurrenceType: Component["occurrenceType"]; taxability: Component["taxability"] }

/** Common starting points. Statutory items are entered by the admin; Horizon does not compute them into pay. */
export const PRESETS: (Draft & { key: string; hint: string })[] = [
  { key: "BASIC", displayName: "Basic salary", category: "EARNING", amountType: "FIXED_AMOUNT", occurrenceType: "RECURRING", taxability: "TAXABLE", hint: "Fixed monthly earning" },
  { key: "DA", displayName: "Dearness allowance", category: "EARNING", amountType: "FIXED_AMOUNT", occurrenceType: "RECURRING", taxability: "TAXABLE", hint: "Counts toward PF wages" },
  { key: "HRA", displayName: "House rent allowance", category: "EARNING", amountType: "FIXED_AMOUNT", occurrenceType: "RECURRING", taxability: "TAXABLE", hint: "Usually 40% of basic (50% in metro cities); exemption depends on regime" },
  { key: "SPECIAL_ALLOWANCE", displayName: "Special allowance", category: "EARNING", amountType: "FIXED_AMOUNT", occurrenceType: "RECURRING", taxability: "TAXABLE", hint: "Fixed monthly earning" },
  { key: "BONUS", displayName: "Bonus", category: "EARNING", amountType: "FIXED_AMOUNT", occurrenceType: "ONE_TIME", taxability: "TAXABLE", hint: "Paid in the first period only" },
  { key: "REIMBURSEMENT", displayName: "Reimbursement", category: "EARNING", amountType: "FIXED_AMOUNT", occurrenceType: "RECURRING", taxability: "NON_TAXABLE", hint: "Against bills; tax treatment needs review" },
  { key: "PF_EMPLOYEE", displayName: "Provident fund (employee)", category: "DEDUCTION", amountType: "FIXED_AMOUNT", occurrenceType: "RECURRING", taxability: "NON_TAXABLE", hint: "Enter the amount; see the EPF estimate below" },
  { key: "PF_EMPLOYER", displayName: "Provident fund (employer)", category: "EMPLOYER_CONTRIBUTION", amountType: "FIXED_AMOUNT", occurrenceType: "RECURRING", taxability: "NON_TAXABLE", hint: "Employer cost, not deducted from pay" },
  { key: "PROFESSIONAL_TAX", displayName: "Professional tax", category: "DEDUCTION", amountType: "FIXED_AMOUNT", occurrenceType: "RECURRING", taxability: "NON_TAXABLE", hint: "Enter the slab amount for the employee's work state" },
];

/** The components most Indian salaries start from. */
export const STANDARD_COMPONENT_KEYS = ["BASIC", "HRA", "SPECIAL_ALLOWANCE", "PF_EMPLOYEE", "PROFESSIONAL_TAX", "PF_EMPLOYER"];

/**
 * Creates whichever standard components are missing, matching by key or display name so an admin's own
 * "Basic salary" is not duplicated. A component created concurrently (409) counts as present.
 */
export async function createStandardComponents(existing: Component[]): Promise<number> {
  const names = new Set(existing.map((component) => component.displayName.toLowerCase()));
  const keys = new Set(existing.map((component) => component.componentKey));
  let created = 0;
  for (const preset of PRESETS.filter((item) => STANDARD_COMPONENT_KEYS.includes(item.key))) {
    if (keys.has(preset.key) || names.has(preset.displayName.toLowerCase())) continue;
    const { key, hint: _hint, ...draft } = preset;
    try {
      await createComponent({ componentKey: key, ...draft, status: "ACTIVE" });
      created++;
    } catch (reason) {
      if (!(reason instanceof ApiError && reason.status === 409)) throw reason;
    }
  }
  return created;
}

/**
 * Splits an annual gross salary into monthly Basic (50% of gross, so wages meet the Code on Social Security's
 * 50% rule), HRA (40% of basic, 50% in metro cities) and Special allowance (the rest). Amounts are whole rupees;
 * the allowance absorbs rounding so the three always add up to the monthly gross.
 */
export function splitAnnualGross(annual: number, metro: boolean) {
  const monthly = Math.round((annual / 12) * 100) / 100;
  const basic = Math.round(monthly * 0.5);
  const hra = Math.round(basic * (metro ? 0.5 : 0.4));
  return { monthly, BASIC: basic, HRA: hra, SPECIAL_ALLOWANCE: Math.round((monthly - basic - hra) * 100) / 100 };
}

const categoryLabel: Record<ComponentCategory, string> = { EARNING: "Earning", DEDUCTION: "Deduction", EMPLOYER_CONTRIBUTION: "Employer contribution" };
const basisLabel = (category: ComponentCategory) => category === "EARNING" ? "of fixed earnings" : "of gross pay";
const NEW = "__new__";

/**
 * Salary builder: add pay components one at a time, see every line with its calculated amount, and a live
 * breakdown of gross, deductions, estimated net, employer contributions and employer cost.
 */
export function CompensationForm({ employee, profiles, onSaved, submitLabel = "Save salary", locale }: {
  employee: PayrollEmployee; profiles: Profile[]; onSaved(profile: Profile): void | Promise<void>; submitLabel?: string; locale?: string;
}) {
  const [components, setComponents] = useState<Component[] | null>(null);
  const [values, setValues] = useState<Values>({});
  const [order, setOrder] = useState<string[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState(() => defaultStart(employee, profiles));
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [estimate, setEstimate] = useState<StatutoryEstimate | null>(null), [estimating, setEstimating] = useState(false);
  const [annualGross, setAnnualGross] = useState(""), [metro, setMetro] = useState(false), [seeding, setSeeding] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const money = (value: number) => formatMoney(value, employee.currency, locale);
  const loadComponents = () => getComponents()
    .then((items) => { const active = items.filter((item) => item.status === "ACTIVE"); setComponents(active); return active; })
    .catch((reason) => { setComponents([]); setError(reason instanceof ApiError ? reason.message : "Unable to load pay components"); return [] as Component[]; });
  useEffect(() => { void loadComponents(); }, []);

  const byKey = new Map((components ?? []).map((component) => [component.componentKey, component]));
  const chosen = order.map((key) => byKey.get(key)).filter((item): item is Component => Boolean(item));
  const totals = estimatePay(chosen, values);
  const problems = validate(chosen, values, totals);
  const add = (component: Component) => {
    setOrder((current) => current.includes(component.componentKey) ? current : [...current, component.componentKey]);
    setValues((current) => ({ ...current, [component.componentKey]: current[component.componentKey] ?? "" }));
    setAdding(false); setEstimate(null);
    // Move focus to the new line's amount so keyboard users can type it straight away.
    requestAnimationFrame(() => document.getElementById(`salary-value-${component.componentKey}`)?.focus());
  };
  const remove = (key: string) => {
    setOrder((current) => current.filter((item) => item !== key));
    setValues((current) => { const next = { ...current }; delete next[key]; return next; });
    setEstimate(null);
    addButton.current?.focus();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (problems.length) { setError(problems[0]); return; }
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
  const addStandard = async () => {
    setSeeding(true); setError("");
    try { await createStandardComponents(components ?? []); return await loadComponents(); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to add the standard components"); return null; }
    finally { setSeeding(false); }
  };
  const split = Number(annualGross) > 0 ? splitAnnualGross(Number(annualGross), metro) : null;
  const fillFromGross = async () => {
    if (!split) { setError("Enter the annual gross salary first."); return; }
    const splitKeys = ["BASIC", "HRA", "SPECIAL_ALLOWANCE"] as const;
    let list = components ?? [];
    if (splitKeys.some((key) => !list.some((component) => component.componentKey === key))) list = (await addStandard()) ?? list;
    const unusable = splitKeys.map((key) => list.find((component) => component.componentKey === key))
      .find((component) => !component || component.category !== "EARNING" || component.amountType !== "FIXED_AMOUNT" || component.occurrenceType !== "RECURRING");
    if (unusable !== undefined || list.length === 0) {
      setError(unusable ? `${unusable.displayName} must be a recurring fixed-amount earning to be filled from gross salary. Enter the lines yourself instead.` : "Basic salary, HRA and Special allowance components are needed. Add them under Salary components.");
      return;
    }
    setOrder((current) => [...splitKeys, ...current.filter((key) => !(splitKeys as readonly string[]).includes(key))]);
    setValues((current) => ({ ...current, ...Object.fromEntries(splitKeys.map((key) => [key, String(split[key])])) }));
    setEstimate(null); setError("");
  };
  const checkStatutory = () => {
    const basic = chosen.filter(isPfWage).reduce((sum, component) => sum + lineAmount(component, values, chosen), 0);
    setEstimating(true); setError("");
    void getStatutoryEstimate(employee.employeeCode, { asOf: effectiveFrom, basicWages: round2(basic), grossWages: round2(totals.gross) })
      .then(setEstimate)
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Unable to estimate EPF and ESI"))
      .finally(() => setEstimating(false));
  };

  if (components === null) return <p role="status">Loading pay components…</p>;
  const period = employee.payFrequency === "MONTHLY" ? "month" : employee.payFrequency === "WEEKLY" ? "week" : "two weeks";
  return <form className="salary-form salary-builder" aria-label="Salary" onSubmit={submit} noValidate>
    {error && <Notice>{error}</Notice>}
    <div className="form-grid">
      <Field label="Salary starts on" hint="Applies to every component below. Use the first day of a pay period; partial periods are not pro-rated.">
        <input type="date" required value={effectiveFrom} onChange={(event) => { setEffectiveFrom(event.target.value); setEstimate(null); }} />
      </Field>
      <Field label="Currency" hint="From the employee’s payroll settings."><input value={employee.currency} readOnly aria-readonly="true" /></Field>
      <label>Pay frequency<input value={humanize(employee.payFrequency)} readOnly aria-readonly="true" /></label>
    </div>

    {employee.payFrequency === "MONTHLY" && <section className="gross-builder" aria-labelledby="gross-builder-heading">
      <h3 id="gross-builder-heading">Build from annual gross salary</h3>
      <div className="gross-builder-row">
        <Field label="Annual gross salary" hint="Before deductions. Employer PF and other employer costs are not part of it.">
          <input type="number" inputMode="decimal" min="0" step="1" value={annualGross} placeholder="e.g. 600000" onChange={(event) => setAnnualGross(event.target.value)} />
        </Field>
        <label className="checkbox-label"><input type="checkbox" checked={metro} onChange={(event) => setMetro(event.target.checked)} /> Metro city (HRA at 50% of basic)</label>
        <Button type="button" disabled={!split || seeding} onClick={() => void fillFromGross()}>{seeding ? "Adding components…" : "Fill salary lines"}</Button>
      </div>
      {split && <p className="snapshot-note" aria-live="polite">{money(split.monthly)} a month: Basic {money(split.BASIC)} · HRA {money(split.HRA)} · Special allowance {money(split.SPECIAL_ALLOWANCE)}. Basic is 50% of gross, HRA {metro ? 50 : 40}% of basic and the allowance is the rest; you can change any line afterwards.</p>}
    </section>}

    <section className="salary-lines-section" aria-labelledby="salary-lines-heading">
      <div className="section-heading">
        <h3 id="salary-lines-heading">Pay components</h3>
        <Button ref={addButton} type="button" variant="primary" aria-expanded={adding} onClick={() => setAdding((open) => !open)}>＋ Add pay component</Button>
      </div>
      {adding && <ComponentPicker components={components.filter((component) => !order.includes(component.componentKey))} existing={components}
        onCancel={() => { setAdding(false); addButton.current?.focus(); }}
        onPick={add}
        onCreate={async (draft) => {
          const key = componentKeyFromName(draft.displayName);
          try {
            await createComponent({ componentKey: key, ...draft, status: "ACTIVE" });
          } catch (reason) {
            // Already created (for example by a retried request): reuse it rather than failing.
            if (!(reason instanceof ApiError && reason.status === 409)) throw reason;
          }
          const fresh = await loadComponents();
          const created = fresh.find((component) => component.componentKey === key);
          if (!created) throw new Error(`A component with the key ${key} exists but is inactive. Activate it under Salary components or choose another name.`);
          add(created);
        }} />}
      {chosen.length === 0 ? <div className="empty-inline">
          <p>No pay components yet. Start with basic salary, then add allowances, deductions and employer contributions.</p>
          {!STANDARD_COMPONENT_KEYS.every((key) => byKey.has(key)) && <Button type="button" disabled={seeding} onClick={() => void addStandard()}>
            {seeding ? "Adding…" : components.length ? "Add missing standard Indian components" : "Add standard Indian components"}</Button>}
        </div>
        : <ul className="salary-lines">
          {chosen.map((component) => {
            const percent = component.amountType === "PERCENTAGE";
            const amount = lineAmount(component, values, chosen);
            const id = `salary-value-${component.componentKey}`;
            return <li key={component.componentKey} className={`salary-line ${component.category.toLowerCase()}`}>
              <div className="salary-line-name">
                <strong>{component.displayName}</strong>
                <small>{categoryLabel[component.category]} · {percent ? `% ${basisLabel(component.category)}` : "Fixed amount"} · {component.occurrenceType === "ONE_TIME" ? "One-time (first period)" : "Recurring"} · {humanize(component.taxability)}</small>
              </div>
              <div className="salary-line-value">
                <input id={id} type="number" inputMode="decimal" min="0" max={percent ? 100 : undefined} step="0.01" required
                  aria-label={`${component.displayName} ${percent ? "percentage" : `amount in ${employee.currency}`}`}
                  placeholder={percent ? "%" : "0.00"} value={values[component.componentKey] ?? ""}
                  onChange={(event) => { setValues((current) => ({ ...current, [component.componentKey]: event.target.value })); setEstimate(null); }} />
                <span className="salary-line-unit" aria-hidden="true">{percent ? "%" : employee.currency}</span>
              </div>
              <span className="salary-line-amount" aria-label={`${component.displayName} per ${period}`}>
                {component.category === "DEDUCTION" ? "−" : ""}{money(amount)}
              </span>
              <Button type="button" size="sm" aria-label={`Remove ${component.displayName}`} onClick={() => remove(component.componentKey)}>Remove</Button>
            </li>;
          })}
        </ul>}
    </section>

    {chosen.length > 0 && <dl className="pay-estimate salary-breakdown" aria-label="Estimated pay">
      <div><dt>Gross earnings</dt><dd>{money(totals.gross)}</dd></div>
      <div><dt>Employee deductions</dt><dd>{money(totals.deductions)}</dd></div>
      <div className="net"><dt>Estimated net pay</dt><dd>{money(totals.net)}</dd></div>
      <div><dt>Employer contributions</dt><dd>{money(totals.employer)}</dd></div>
      <div><dt>Employer cost</dt><dd>{money(totals.employerCost)}</dd></div>
      <p className="snapshot-note">Estimate per {period} for recurring components only. Net pay includes only the deductions listed above — PF, ESI, professional tax and income-tax (TDS) are not deducted unless you add them as components. Final amounts are calculated in the pay run.</p>
    </dl>}
    {problems.length > 0 && chosen.length > 0 && <ul className="field-errors" aria-live="polite">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}

    {employee.currency === "INR" && chosen.some((component) => component.category === "EARNING") && <section className="statutory-estimate" aria-labelledby="statutory-estimate-heading">
      <div className="section-heading">
        <h3 id="statutory-estimate-heading">EPF and ESI estimate</h3>
        <Button type="button" disabled={estimating || problems.length > 0} onClick={checkStatutory}>{estimating ? "Estimating…" : estimate ? "Refresh estimate" : "Estimate EPF and ESI"}</Button>
      </div>
      <p className="snapshot-note">For guidance only. Uses this employee’s EPF and ESI decisions from Payroll setup and the rates in force on the salary start date. Nothing is added to the salary automatically.</p>
      {estimate && <StatutoryEstimateView estimate={estimate} money={money} locale={locale} />}
    </section>}

    <div className="form-actions"><Button variant="primary" disabled={busy || components.length === 0}>{busy ? "Saving…" : submitLabel}</Button></div>
  </form>;
}

function ComponentPicker({ components, existing, onPick, onCreate, onCancel }: {
  components: Component[]; existing: Component[]; onPick(component: Component): void; onCreate(draft: Draft): Promise<void>; onCancel(): void;
}) {
  const id = useId();
  const [choice, setChoice] = useState("");
  const [draft, setDraft] = useState<Draft>({ displayName: "", category: "EARNING", amountType: "FIXED_AMOUNT", occurrenceType: "RECURRING", taxability: "TAXABLE" });
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const options: SelectOption[] = [
    ...components.map((component) => ({ value: component.componentKey, label: component.displayName, subLabel: `${categoryLabel[component.category]} · ${component.amountType === "PERCENTAGE" ? "%" : "Fixed"}`, keywords: [component.componentKey, categoryLabel[component.category]] })),
    { value: NEW, label: "Create a new pay component…", keywords: ["new", "create", "custom"] },
  ];
  const usedNames = new Set(existing.map((component) => component.displayName.toLowerCase()));
  const presets = PRESETS.filter((preset) => !existing.some((component) => component.componentKey === preset.key) && !usedNames.has(preset.displayName.toLowerCase()));
  const pick = (value: string) => {
    setChoice(value); setError("");
    const component = components.find((item) => item.componentKey === value);
    if (component) onPick(component);
  };
  const create = () => {
    const name = draft.displayName.trim();
    if (!name) { setError("Enter a name for the new component."); return; }
    if (usedNames.has(name.toLowerCase())) { setError(`A component called “${name}” already exists. Choose it from the list instead.`); return; }
    setBusy(true); setError("");
    void onCreate({ ...draft, displayName: name })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to create the component"))
      .finally(() => setBusy(false));
  };
  return <div className="component-picker-panel" role="group" aria-labelledby={`${id}-title`}
    onKeyDown={(event) => { if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); onCancel(); } }}>
    <h4 id={`${id}-title`}>Add pay component</h4>
    <SearchSelect label="Pay component" value={choice} options={options} onChange={pick} placeholder="Search components…" searchPlaceholder="Search by name or type…" autoFocus />
    {choice === NEW && <div className="component-create">
      {presets.length > 0 && <div className="preset-row" role="group" aria-label="Common components">
        {presets.map((preset) => <button key={preset.key} type="button" className="chip" title={preset.hint}
          onClick={() => setDraft({ displayName: preset.displayName, category: preset.category, amountType: preset.amountType, occurrenceType: preset.occurrenceType, taxability: preset.taxability })}>{preset.displayName}</button>)}
      </div>}
      <div className="form-grid">
        <label>Name<input value={draft.displayName} maxLength={150} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} placeholder="e.g. Conveyance allowance" /></label>
        <Dropdown label="Category" value={draft.category} onChange={(value) => setDraft({ ...draft, category: value as ComponentCategory })}
          options={[{ value: "EARNING", label: "Earning", subLabel: "Adds to gross pay" }, { value: "DEDUCTION", label: "Deduction", subLabel: "Reduces net pay" }, { value: "EMPLOYER_CONTRIBUTION", label: "Employer contribution", subLabel: "Employer cost, not deducted" }]} />
        <Dropdown label="Amount" value={draft.amountType} onChange={(value) => setDraft({ ...draft, amountType: value as Draft["amountType"] })}
          options={[{ value: "FIXED_AMOUNT", label: "Fixed amount" }, { value: "PERCENTAGE", label: `Percentage ${basisLabel(draft.category)}` }]} />
        <Dropdown label="Frequency" value={draft.occurrenceType} onChange={(value) => setDraft({ ...draft, occurrenceType: value as Draft["occurrenceType"] })}
          options={[{ value: "RECURRING", label: "Recurring", subLabel: "Every pay period" }, { value: "ONE_TIME", label: "One-time", subLabel: "First pay period only" }]} />
        <Dropdown label="Tax treatment" value={draft.taxability} onChange={(value) => setDraft({ ...draft, taxability: value as Draft["taxability"] })}
          options={[{ value: "TAXABLE", label: "Taxable" }, { value: "NON_TAXABLE", label: "Non-taxable" }]} />
      </div>
      <p className="snapshot-note">Tax treatment is recorded for reporting; Horizon does not calculate income tax.</p>
    </div>}
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="form-actions">
      {choice === NEW && <Button type="button" variant="primary" disabled={busy} onClick={create}>{busy ? "Creating…" : "Create and add"}</Button>}
      <Button type="button" onClick={onCancel}>Cancel</Button>
    </div>
  </div>;
}

const estimateStatusLabel: Record<string, string> = { ESTIMATED: "Estimated", NOT_APPLICABLE: "Not applicable", NEEDS_DECISION: "Decision needed", ABOVE_CEILING: "Above ceiling", UNAVAILABLE: "Not calculated" };

export function StatutoryEstimateView({ estimate, money, locale }: { estimate: StatutoryEstimate; money(value: number): string; locale?: string }) {
  return <div className="statutory-estimate-result">
    <table className="compact-table">
      <caption className="visually-hidden">EPF, ESI and other statutory items for this salary</caption>
      <thead><tr><th scope="col">Item</th><th scope="col">Paid by</th><th scope="col">Amount</th><th scope="col">Status</th></tr></thead>
      <tbody>{estimate.lines.map((line) => <tr key={`${line.scheme}-${line.label}`}>
        <th scope="row">{line.label}<small>{line.note}</small></th>
        <td>{line.party === "EMPLOYER" ? "Employer" : "Employee"}</td>
        <td>{line.amount === null ? "—" : money(line.amount)}</td>
        <td><span className={`badge ${line.status === "ESTIMATED" ? "success" : line.status === "UNAVAILABLE" || line.status === "NOT_APPLICABLE" ? "neutral" : "warning"}`}>{estimateStatusLabel[line.status] ?? humanize(line.status)}</span></td>
      </tr>)}</tbody>
    </table>
    <p className="snapshot-note">PF wages {money(estimate.pfWages)} · Estimated employee share {money(estimate.employeeDeductionTotal)} · Estimated employer share {money(estimate.employerContributionTotal)}. To include them in pay runs, add matching deduction and employer-contribution components.</p>
    {estimate.warnings.length > 0 && <ul className="estimate-warnings">{estimate.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
    {estimate.sources.length > 0 && <details className="estimate-sources">
      <summary>Rates used and sources</summary>
      <ul>{estimate.sources.map((source) => <li key={`${source.scheme}-${source.effectiveFrom}`}>
        <strong>{source.scheme}</strong> from {formatDate(source.effectiveFrom, locale)}{source.effectiveTo ? ` to ${formatDate(source.effectiveTo, locale)}` : ""}: {source.reference}
        {source.url && <> <a href={source.url} target="_blank" rel="noreferrer noopener">Official source</a></>}
        {source.reviewStatus === "REQUIRES_EMPLOYER_REVIEW" && <> · Review with your payroll adviser before relying on it.</>}
      </li>)}</ul>
    </details>}
  </div>;
}

function lineAmount(component: Component, values: Values, chosen: Component[]): number {
  const value = Number(values[component.componentKey] || 0);
  if (!Number.isFinite(value)) return 0;
  if (component.amountType !== "PERCENTAGE") return value;
  const totals = estimatePay(chosen.filter((item) => item.occurrenceType === "RECURRING"), values);
  const fixedEarnings = chosen.filter((item) => item.category === "EARNING" && item.amountType === "FIXED_AMOUNT")
    .reduce((sum, item) => sum + (Number(values[item.componentKey]) || 0), 0);
  return (component.category === "EARNING" ? fixedEarnings : totals.gross) * value / 100;
}

/** Basic pay and dearness allowance make up PF wages before the 50% rule is applied on the server. */
function isPfWage(component: Component): boolean {
  return component.category === "EARNING" && (/^(BASIC|DA)(_|$)/.test(component.componentKey) || /\b(basic|dearness)\b/i.test(component.displayName));
}

function validate(chosen: Component[], values: Values, totals: ReturnType<typeof estimatePay>): string[] {
  const problems: string[] = [];
  if (!chosen.length) return ["Add at least one pay component."];
  if (!chosen.some((component) => component.category === "EARNING")) problems.push("Add at least one earning, such as basic salary.");
  for (const component of chosen) {
    const raw = values[component.componentKey] ?? "";
    const value = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(value)) problems.push(`Enter ${component.amountType === "PERCENTAGE" ? "a percentage" : "an amount"} for ${component.displayName}.`);
    else if (value < 0) problems.push(`${component.displayName} cannot be negative.`);
    else if (component.amountType === "PERCENTAGE" && value > 100) problems.push(`${component.displayName} cannot be more than 100%.`);
  }
  if (totals.deductions > totals.gross + 0.005) problems.push("Deductions are more than gross earnings. Reduce the deductions or add earnings.");
  return problems;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

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
