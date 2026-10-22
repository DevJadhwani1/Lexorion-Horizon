import type { Employee, Reference } from "../../features/workforce/workforceApi";
import { personName } from "../../lib/format";
import { Field } from "../../components/ui/Field";

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

interface Props {
  employee?: Employee;
  /** Show the employee code field (create only; codes are immutable). */
  includeCode?: boolean;
  suggestedCode?: string;
  departments: Reference[];
  designations: Reference[];
  managers: Employee[];
}

/**
 * Employee detail inputs with human labels and pickers for related records. Field names match the Workforce API,
 * so the surrounding form can submit `FormData` directly. Empty optional pickers submit an empty string.
 */
export function EmployeeFields({ employee, includeCode = false, suggestedCode = "", departments, designations, managers }: Props) {
  const activeOrCurrent = (items: Reference[], current: string | null | undefined) => items.filter((item) => item.status === "ACTIVE" || item.key === current);
  const managerOptions = managers.filter((item) => item.employeeCode !== employee?.employeeCode && (item.status === "ACTIVE" || item.employeeCode === employee?.reportingManagerEmployeeCode));
  return <>
    {includeCode && <Field label="Employee code" hint="Used on payslips and reports. It cannot be changed later.">
      <input name="employeeCode" required defaultValue={suggestedCode} pattern="[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?" title="Letters, numbers and hyphens" />
    </Field>}
    <label>First name<input name="firstName" required defaultValue={employee?.firstName ?? ""} autoComplete="off" /></label>
    {employee && <label>Middle name<input name="middleName" defaultValue={employee.middleName ?? ""} autoComplete="off" /></label>}
    <label>Last name<input name="lastName" required defaultValue={employee?.lastName ?? ""} autoComplete="off" /></label>
    <label>Work email<input name="workEmail" type="email" required defaultValue={employee?.workEmail ?? ""} autoComplete="off" /></label>
    <label>Phone<input name="phone" type="tel" defaultValue={employee?.phone ?? ""} autoComplete="off" /></label>
    <label>Joining date<input name="joiningDate" type="date" required defaultValue={employee?.joiningDate ?? ""} /></label>
    <label>Department
      <select name="departmentKey" defaultValue={employee?.departmentKey ?? ""}>
        <option value="">No department</option>
        {activeOrCurrent(departments, employee?.departmentKey).map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
      </select>
    </label>
    <label>Designation
      <select name="designationKey" defaultValue={employee?.designationKey ?? ""}>
        <option value="">No designation</option>
        {activeOrCurrent(designations, employee?.designationKey).map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
      </select>
    </label>
    <label>Reporting manager
      <select name="reportingManagerEmployeeCode" defaultValue={employee?.reportingManagerEmployeeCode ?? ""}>
        <option value="">No manager</option>
        {managerOptions.map((item) => <option key={item.employeeCode} value={item.employeeCode}>{personName(item)} ({item.employeeCode})</option>)}
      </select>
    </label>
  </>;
}
