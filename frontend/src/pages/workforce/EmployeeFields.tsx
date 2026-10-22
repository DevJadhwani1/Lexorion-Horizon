import { useId, useState } from "react";
import type { Employee, Reference } from "../../features/workforce/workforceApi";
import { personName } from "../../lib/format";
import { Button } from "../../components/ui/Button";
import { PhoneInput } from "../../components/ui/PhoneInput";
import { Dropdown } from "../../components/ui/Dropdown";

/**
 * Company prefix for employee codes, 2–4 characters: the organization code when it is already that short
 * (`LEX`), otherwise the initials of a multi-word name (`Tata Consultancy Services` → `TCS`) or the first three
 * letters of a one-word name (`Lexorion` → `LEX`).
 */
export function employeeCodePrefix(organizationName: string, organizationCode = ""): string {
  const code = organizationCode.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
  if (code.length >= 2 && code.length <= 4) return code;
  const words = organizationName.toUpperCase().normalize("NFKD").replaceAll(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const initials = words.map((word) => word[0]).join("");
  if (words.length >= 2 && initials.length >= 2) return initials.slice(0, 4);
  const letters = words.join("");
  return letters.length >= 2 ? letters.slice(0, 3) : "EMP";
}

/** Next unused code with the company prefix: `LEX-001`, then `LEX-002`. Codes with other prefixes are ignored. */
export function suggestEmployeeCode(existing: string[], prefix = "EMP"): string {
  const taken = new Set(existing.map((code) => code.toUpperCase()));
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, "i");
  let width = 3, highest = 0;
  for (const code of existing) {
    const match = pattern.exec(code);
    if (match) { highest = Math.max(highest, Number(match[1])); width = Math.max(width, match[1].length); }
  }
  let next = highest + 1, candidate = `${prefix}-${String(next).padStart(width, "0")}`;
  while (taken.has(candidate)) candidate = `${prefix}-${String(++next).padStart(width, "0")}`;
  return candidate;
}

export const EMPLOYMENT_TYPES = [
  { value: "FULL_TIME", label: "Full-time" }, { value: "PART_TIME", label: "Part-time" },
  { value: "CONTRACT", label: "Contract" }, { value: "INTERN", label: "Intern" },
];

/** Workforce employee codes: letters and digits, with single hyphens inside, up to 63 characters. */
export const EMPLOYEE_CODE_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

export interface CodeControl {
  value: string;
  suggestion: string;
  onChange(value: string): void;
  error?: string;
}

interface Props {
  employee?: Employee;
  /** Create only (codes are immutable): an editable code that starts as the suggestion. */
  code?: CodeControl;
  departments: Reference[];
  designations: Reference[];
  managers: Employee[];
  defaultPhoneCountry?: string;
}

/**
 * Employee detail inputs grouped into "Personal and contact" and "Employment". Field names match the Workforce
 * API, so the surrounding form can submit `FormData` directly. Empty optional pickers submit an empty string.
 */
export function EmployeeFields({ employee, code, departments, designations, managers, defaultPhoneCountry = "IN" }: Props) {
  const activeOrCurrent = (items: Reference[], current: string | null | undefined) => items.filter((item) => item.status === "ACTIVE" || item.key === current);
  const managerOptions = managers.filter((item) => item.employeeCode !== employee?.employeeCode && (item.status === "ACTIVE" || item.employeeCode === employee?.reportingManagerEmployeeCode));
  const [phone, setPhone] = useState(employee?.phone ?? "");
  const codeId = useId();
  const codeFormatError = code && code.value && !EMPLOYEE_CODE_PATTERN.test(code.value) ? "Use letters, digits and single hyphens, for example LEX-012." : "";
  const codeMessage = code?.error || codeFormatError;
  return <>
    <fieldset className="form-section">
      <legend>Personal and contact</legend>
      <div className="form-grid">
        <label>First name<input name="firstName" required maxLength={100} defaultValue={employee?.firstName ?? ""} autoComplete="off" /></label>
        <label><span>Middle name <span className="field-optional">(optional)</span></span><input name="middleName" maxLength={100} defaultValue={employee?.middleName ?? ""} autoComplete="off" /></label>
        <label>Last name<input name="lastName" required maxLength={100} defaultValue={employee?.lastName ?? ""} autoComplete="off" /></label>
        <label>Work email<input name="workEmail" type="email" required maxLength={254} defaultValue={employee?.workEmail ?? ""} autoComplete="off" /></label>
        <PhoneInput name="phone" countryName="phoneCountry" label="Phone" value={phone} onChange={setPhone}
          defaultCountryCode={employee?.phoneCountry ?? defaultPhoneCountry} className="span-2" />
      </div>
    </fieldset>
    <fieldset className="form-section">
      <legend>Employment</legend>
      <div className="form-grid">
        {code && <div className="field">
          <label htmlFor={codeId}>Employee code</label>
          <input id={codeId} name="employeeCode" required maxLength={63} value={code.value} autoComplete="off" spellCheck={false}
            aria-invalid={Boolean(codeMessage)} aria-describedby={`${codeId}-help`}
            onChange={(event) => code.onChange(event.target.value.toUpperCase())} />
          <small id={`${codeId}-help`} className={codeMessage ? "field-error" : "field-hint"} role={codeMessage ? "alert" : undefined}>
            {codeMessage || (code.value === code.suggestion ? "Next available code. You can change it." : "Custom code.")}
          </small>
          {code.value !== code.suggestion && code.suggestion && <Button type="button" size="sm" onClick={() => code.onChange(code.suggestion)}>Use {code.suggestion}</Button>}
        </div>}
        <label>Joining date<input name="joiningDate" type="date" required defaultValue={employee?.joiningDate ?? ""} /></label>
        <Dropdown label="Employment type" name="employmentType" defaultValue={employee?.employmentType ?? (employee ? "" : "FULL_TIME")}
          options={employee && !employee.employmentType ? [{ value: "", label: "Not set" }, ...EMPLOYMENT_TYPES] : EMPLOYMENT_TYPES} />
        {!employee && <Dropdown label="Employment status" name="status" defaultValue="ACTIVE"
          options={[{ value: "ACTIVE", label: "Active", subLabel: "Working now" }, { value: "ON_LEAVE", label: "On leave", subLabel: "Joined, currently on leave" }]} />}
        <Dropdown label="Department (optional)" name="departmentKey" defaultValue={employee?.departmentKey ?? ""}
          options={[{ value: "", label: "No department" }, ...activeOrCurrent(departments, employee?.departmentKey).map((item) => ({ value: item.key, label: item.name }))]} />
        <Dropdown label="Designation (optional)" name="designationKey" defaultValue={employee?.designationKey ?? ""}
          options={[{ value: "", label: "No designation" }, ...activeOrCurrent(designations, employee?.designationKey).map((item) => ({ value: item.key, label: item.name }))]} />
        <Dropdown label="Reporting manager (optional)" name="reportingManagerEmployeeCode" defaultValue={employee?.reportingManagerEmployeeCode ?? ""}
          hint={managerOptions.length ? undefined : "No other active employees yet. You can set a manager later."}
          options={[{ value: "", label: "No manager" }, ...managerOptions.map((item) => ({ value: item.employeeCode, label: personName(item), subLabel: item.employeeCode }))]} />
      </div>
    </fieldset>
  </>;
}
