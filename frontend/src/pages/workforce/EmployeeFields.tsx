import type { Employee, Reference } from "../../features/workforce/workforceApi";
import { personName } from "../../lib/format";
import { Field } from "../../components/ui/Field";

/** Suggests the next employee code from existing codes (`EMP-007` after `EMP-006`). */
export function suggestEmployeeCode(existing: string[]): string {
  let prefix = "EMP-", width = 3, highest = 0;
  const counts = new Map<string, number>();
  for (const code of existing) {
    const match = /^(.*?)(\d+)$/.exec(code);
    if (match) counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  }
  const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (common !== undefined) prefix = common;
  for (const code of existing) {
    const match = /^(.*?)(\d+)$/.exec(code);
    if (match && match[1] === prefix) { highest = Math.max(highest, Number(match[2])); width = Math.max(width, match[2].length); }
  }
  let next = highest + 1, candidate = `${prefix}${String(next).padStart(width, "0")}`;
  const taken = new Set(existing.map((code) => code.toUpperCase()));
  while (taken.has(candidate.toUpperCase())) candidate = `${prefix}${String(++next).padStart(width, "0")}`;
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
