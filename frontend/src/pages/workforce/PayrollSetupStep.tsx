import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { ApiError } from "../../api/types";
import { Button } from "../../components/ui/Button";
import { Dropdown } from "../../components/ui/Dropdown";
import { Field } from "../../components/ui/Field";
import { Notice } from "../../components/ui/Page";
import {
  createPayrollEmployee, saveStatutoryProfile, updatePayrollEmployee,
  type Applicability, type PaymentMethod, type PayrollSetup, type SectionStatus, type StatutoryProfileUpdate,
} from "../../features/payroll/payrollApi";
import type { Employee } from "../../features/workforce/workforceApi";
import { formatDate } from "../../lib/format";
import { INDIAN_STATES } from "../../data/indianStates";

export const sectionStatusLabel: Record<SectionStatus, string> = {
  NOT_STARTED: "Not started", IN_PROGRESS: "In progress", COMPLETE: "Complete", NOT_APPLICABLE: "Not applicable", PENDING_VERIFICATION: "Pending verification",
};
const sectionTone: Record<SectionStatus, string> = { NOT_STARTED: "neutral", IN_PROGRESS: "warning", COMPLETE: "success", NOT_APPLICABLE: "neutral", PENDING_VERIFICATION: "warning" };

export function SectionStatusBadge({ status }: { status: SectionStatus }) {
  return <span className={`badge ${sectionTone[status]}`}>{sectionStatusLabel[status]}</span>;
}

const applicabilityOptions = [
  { value: "UNDECIDED", label: "Decide later" },
  { value: "APPLICABLE", label: "Applies" },
  { value: "NOT_APPLICABLE", label: "Does not apply" },
];
const stateOptions = [{ value: "", label: "Not set" }, ...INDIAN_STATES.map((state) => ({ value: state.code, label: state.name, subLabel: state.code }))];

/**
 * Step 2: payroll enrollment, payment details and statutory profile. Enrollment is created once; everything else
 * is optional at this point and saved as entered. Bank account, PAN, UAN and ESI IP number are write-only: the saved
 * value is shown masked and is replaced only when a new value is typed.
 */
export function PayrollSetupStep({ employee, setup, defaultCurrency, onSaved, onSkip, onFinishLater }: {
  employee: Employee; setup: PayrollSetup | null; defaultCurrency: string;
  onSaved(): void; onSkip(): void; onFinishLater(): void;
}) {
  const profile = setup?.statutoryProfile ?? null;
  const enrollment = setup?.enrollment ?? null;
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(profile?.paymentMethod ?? "");
  const [pf, setPf] = useState<Applicability>(profile?.pfApplicability ?? "UNDECIDED");
  const [esi, setEsi] = useState<Applicability>(profile?.esiApplicability ?? "UNDECIDED");
  const [pt, setPt] = useState<Applicability>(profile?.ptApplicability ?? "UNDECIDED");
  const [lwf, setLwf] = useState<Applicability>(profile?.lwfApplicability ?? "UNDECIDED");
  const [verified, setVerified] = useState({ bank: profile?.bankVerified ?? false, pan: profile?.panVerified ?? false, pf: profile?.pfVerified ?? false, esi: profile?.esiVerified ?? false });
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const sectionOf = (key: string) => setup?.sections.find((section) => section.key === key);
  // Typing a replacement identifier clears its verification until the admin confirms it again.
  const replaced = (key: keyof typeof verified) => (event: { target: { value: string } }) => { if (event.target.value.trim()) setVerified((current) => ({ ...current, [key]: false })); };

  // Which submit button was used; a ref because the click and the submit happen in the same event.
  const finishLater = useRef(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const later = finishLater.current;
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const update: StatutoryProfileUpdate = {
      bankVerified: verified.bank, panVerified: verified.pan, pfVerified: verified.pf, esiVerified: verified.esi,
      pfApplicability: pf, esiApplicability: esi, ptApplicability: pt, lwfApplicability: lwf,
      ptState: pt === "APPLICABLE" ? text("ptState") : "", lwfState: lwf === "APPLICABLE" ? text("lwfState") : "",
      pfHigherWagesOptIn: pf === "APPLICABLE" && form.get("pfHigherWagesOptIn") === "on",
    };
    if (paymentMethod) update.paymentMethod = paymentMethod;
    if (form.get("taxRegime")) update.taxRegime = text("taxRegime") as StatutoryProfileUpdate["taxRegime"];
    if (paymentMethod === "BANK_TRANSFER") { update.bankAccountHolder = text("bankAccountHolder"); update.bankIfsc = text("bankIfsc"); update.bankName = text("bankName"); }
    // Write-only identifiers: only sent when the admin typed a new value.
    for (const name of ["bankAccountNumber", "pan", "uan", "esiIpNumber"] as const) if (text(name)) update[name] = text(name);
    if (pf === "APPLICABLE" && text("pfMemberSince")) update.pfMemberSince = text("pfMemberSince");
    const details = { payGroup: text("payGroup"), workState: text("workState"), workLocation: text("workLocation") };
    setBusy(true); setError("");
    (async () => {
      if (!enrollment) {
        try {
          await createPayrollEmployee({ employeeCode: employee.employeeCode, status: "ACTIVE", currency: text("currency").toUpperCase(), payFrequency: text("payFrequency"), effectiveFrom: text("effectiveFrom") });
        } catch (reason) {
          // Saved earlier (another tab, or a response that never arrived): keep going with the existing enrollment.
          if (!(reason instanceof ApiError && reason.status === 409 && /already exists/i.test(reason.message))) throw reason;
        }
        await updatePayrollEmployee(employee.employeeCode, details);
      } else {
        await updatePayrollEmployee(employee.employeeCode, { ...details, payFrequency: text("payFrequency"), effectiveFrom: text("effectiveFrom"), currency: text("currency").toUpperCase() });
      }
      await saveStatutoryProfile(employee.employeeCode, update);
    })().then(() => (later ? onFinishLater() : onSaved()))
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Unable to save payroll setup."))
      .finally(() => setBusy(false));
  };

  return <form aria-label="Payroll setup" onSubmit={submit} className="payroll-setup">
    <h2>Payroll setup for {employee.firstName} {employee.lastName}</h2>
    <p className="snapshot-note">Only the enrollment details are needed now. Everything else can be completed later — the review shows what is still missing before payroll.</p>
    {error && <Notice>{error}</Notice>}

    <Section title="Payroll enrollment" status={sectionOf("enrollment")?.status} note={sectionOf("enrollment")?.note}>
      <Field label="Currency" hint={enrollment ? "Currency of salaries and payslips." : "Your organization’s currency by default."}>
        <input name="currency" required pattern="[A-Za-z]{3}" maxLength={3} defaultValue={enrollment?.currency ?? defaultCurrency} placeholder="e.g. INR" />
      </Field>
      <Dropdown label="Pay frequency" name="payFrequency" defaultValue={enrollment?.payFrequency ?? "MONTHLY"}
        options={[{ value: "MONTHLY", label: "Monthly" }, { value: "BIWEEKLY", label: "Every two weeks" }, { value: "WEEKLY", label: "Weekly" }]} />
      <Field label="Payroll start date" hint={`Joined ${formatDate(employee.joiningDate)}.`}>
        <input name="effectiveFrom" type="date" required defaultValue={enrollment?.effectiveFrom ?? employee.joiningDate} />
      </Field>
      <label><span>Pay group <span className="field-optional">(optional)</span></span><input name="payGroup" maxLength={63} defaultValue={enrollment?.payGroup ?? ""} placeholder="e.g. Head office staff" /></label>
      <Dropdown label="Work state (optional)" name="workState" defaultValue={enrollment?.workState ?? ""} options={stateOptions} />
      <label><span>Work location <span className="field-optional">(optional)</span></span><input name="workLocation" maxLength={120} defaultValue={enrollment?.workLocation ?? ""} placeholder="e.g. Pune" /></label>
    </Section>

    <Section title="Payment method" status={sectionOf("payment")?.status} note={sectionOf("payment")?.note}>
      <Dropdown label="Paid by" value={paymentMethod} onChange={(value) => setPaymentMethod(value as PaymentMethod | "")}
        options={[...(profile?.paymentMethod ? [] : [{ value: "", label: "Decide later" }]), { value: "BANK_TRANSFER", label: "Bank transfer" }, { value: "CHEQUE", label: "Cheque" }, { value: "CASH", label: "Cash" }]} />
      {paymentMethod === "BANK_TRANSFER" && <>
        <label>Account holder name<input name="bankAccountHolder" maxLength={150} defaultValue={profile?.bankAccountHolder ?? `${employee.firstName} ${employee.lastName}`} autoComplete="off" /></label>
        <SecretField label="Account number" name="bankAccountNumber" saved={profile?.bankAccountNumberMasked} inputMode="numeric" maxLength={40} onChange={replaced("bank")} />
        <label>IFSC<input name="bankIfsc" maxLength={11} defaultValue={profile?.bankIfsc ?? ""} autoComplete="off" spellCheck={false} placeholder="e.g. HDFC0001234" style={{ textTransform: "uppercase" }} /></label>
        <label><span>Bank name <span className="field-optional">(optional)</span></span><input name="bankName" maxLength={120} defaultValue={profile?.bankName ?? ""} autoComplete="off" /></label>
        <Verify label="I have verified these bank details (for example with a cancelled cheque or bank letter)" checked={verified.bank} onChange={(value) => setVerified({ ...verified, bank: value })} />
      </>}
    </Section>

    <Section title="PAN and tax regime" status={sectionOf("tax")?.status} note={sectionOf("tax")?.note}>
      <SecretField label="PAN" name="pan" saved={profile?.panMasked} maxLength={10} placeholder="ABCDE1234F" onChange={replaced("pan")} />
      <Dropdown label="Tax regime" name="taxRegime" defaultValue={profile?.taxRegime ?? ""} hint="The new regime applies unless the employee opts for the old one."
        options={[{ value: "", label: "Not recorded" }, { value: "NEW", label: "New regime" }, { value: "OLD", label: "Old regime" }, { value: "NOT_DECLARED", label: "Not declared yet" }]} />
      <Verify label="PAN verified against the PAN card or e-PAN" checked={verified.pan} onChange={(value) => setVerified({ ...verified, pan: value })} />
      <p className="snapshot-note span-2">Horizon records PAN and regime. It does not calculate income-tax (TDS).</p>
    </Section>

    <Section title="Provident fund (EPF)" status={sectionOf("epf")?.status} note={sectionOf("epf")?.note}>
      <Dropdown label="EPF" value={pf} onChange={(value) => setPf(value as Applicability)} options={applicabilityOptions}
        hint="Horizon does not decide coverage. Confirm it for your establishment and this employee." />
      {pf === "APPLICABLE" && <>
        <SecretField label="UAN" name="uan" saved={profile?.uanMasked} inputMode="numeric" maxLength={12} placeholder="12 digits" optional onChange={replaced("pf")} />
        <label><span>PF member since <span className="field-optional">(optional)</span></span><input name="pfMemberSince" type="date" defaultValue={profile?.pfMemberSince ?? ""} /></label>
        <label className="checkbox-row span-2"><input type="checkbox" name="pfHigherWagesOptIn" defaultChecked={profile?.pfHigherWagesOptIn ?? false} /> Employee and employer contribute on wages above the ceiling (joint option)</label>
        <Verify label="UAN verified on the EPFO portal" checked={verified.pf} onChange={(value) => setVerified({ ...verified, pf: value })} />
      </>}
    </Section>

    <Section title="Employees’ State Insurance (ESI)" status={sectionOf("esi")?.status} note={sectionOf("esi")?.note}>
      <Dropdown label="ESI" value={esi} onChange={(value) => setEsi(value as Applicability)} options={applicabilityOptions} />
      {esi === "APPLICABLE" && <>
        <SecretField label="ESI IP number" name="esiIpNumber" saved={profile?.esiIpNumberMasked} inputMode="numeric" maxLength={10} placeholder="10 digits" optional onChange={replaced("esi")} />
        <Verify label="IP number verified on the ESIC portal" checked={verified.esi} onChange={(value) => setVerified({ ...verified, esi: value })} />
      </>}
    </Section>

    <Section title="Professional tax and labour welfare fund" status={worst(sectionOf("pt")?.status, sectionOf("lwf")?.status)} note={sectionOf("pt")?.note ?? sectionOf("lwf")?.note}>
      <Dropdown label="Professional tax" value={pt} onChange={(value) => setPt(value as Applicability)} options={applicabilityOptions} />
      {pt === "APPLICABLE" ? <Dropdown label="Professional tax state" name="ptState" defaultValue={profile?.ptState ?? enrollment?.workState ?? ""} options={stateOptions} /> : <span className="grid-spacer" aria-hidden="true" />}
      <Dropdown label="Labour welfare fund" value={lwf} onChange={(value) => setLwf(value as Applicability)} options={applicabilityOptions} />
      {lwf === "APPLICABLE" ? <Dropdown label="LWF state" name="lwfState" defaultValue={profile?.lwfState ?? enrollment?.workState ?? ""} options={stateOptions} /> : <span className="grid-spacer" aria-hidden="true" />}
      <p className="snapshot-note span-2">Rates and slabs differ by state. Horizon records applicability only and does not calculate professional tax or LWF.</p>
    </Section>

    <div className="form-actions sticky-actions">
      <Button variant="primary" disabled={busy} onClick={() => { finishLater.current = false; }}>{busy && !finishLater.current ? "Saving…" : "Save and continue"}</Button>
      <Button disabled={busy} onClick={() => { finishLater.current = true; }}>{busy && finishLater.current ? "Saving…" : "Save and review"}</Button>
      {!enrollment && <Button type="button" disabled={busy} onClick={onSkip}>Skip payroll for now</Button>}
    </div>
  </form>;
}

function Section({ title, status, note, children }: { title: string; status?: SectionStatus; note?: string | null; children: ReactNode }) {
  return <fieldset className="form-section">
    <legend>{title}{status && <> <SectionStatusBadge status={status} /></>}</legend>
    {note && <p className="snapshot-note">{note}</p>}
    <div className="form-grid">{children}</div>
  </fieldset>;
}

function Verify({ label, checked, onChange }: { label: string; checked: boolean; onChange(value: boolean): void }) {
  return <label className="checkbox-row span-2"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> {label}</label>;
}

/** Write-only identifier: shows the masked saved value and accepts a replacement. Never pre-filled. */
function SecretField({ label, name, saved, optional = false, onChange, ...input }: {
  label: string; name: string; saved?: string | null; optional?: boolean; onChange(event: { target: { value: string } }): void;
  inputMode?: "numeric"; maxLength?: number; placeholder?: string;
}) {
  return <Field label={<span>{label}{optional && <span className="field-optional"> (optional)</span>}</span>} hint={saved ? `Saved: ${saved}. Leave blank to keep it.` : "Stored securely and shown masked after saving."}>
    <input name={name} autoComplete="off" spellCheck={false} data-sensitive="true" {...input} placeholder={saved ? "Enter a new value to replace" : input.placeholder} onChange={onChange} />
  </Field>;
}

const rank: SectionStatus[] = ["NOT_STARTED", "IN_PROGRESS", "PENDING_VERIFICATION", "COMPLETE", "NOT_APPLICABLE"];
function worst(a?: SectionStatus, b?: SectionStatus): SectionStatus | undefined {
  if (!a || !b) return a ?? b;
  if (a === "NOT_APPLICABLE") return b;
  if (b === "NOT_APPLICABLE") return a;
  return rank.indexOf(a) <= rank.indexOf(b) ? a : b;
}
