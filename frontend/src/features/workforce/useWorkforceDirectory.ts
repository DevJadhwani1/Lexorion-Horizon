import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { personName } from "../../lib/format";
import { getDepartments, getDesignations, getEmployees, type Employee, type Reference } from "./workforceApi";

export interface WorkforceDirectory {
  /** False when the workspace has no Workforce product; screens then show employee codes only. */
  available: boolean;
  loading: boolean;
  error: string;
  employees: Employee[];
  departments: Reference[];
  designations: Reference[];
  find(code: string | null | undefined): Employee | undefined;
  /** "Aarav Shah" when the Workforce record is known, otherwise the code itself. */
  nameOf(code: string | null | undefined): string;
  departmentName(key: string | null | undefined): string;
  designationName(key: string | null | undefined): string;
  reload(): Promise<void>;
}

/** Loads every employee in the workspace, page by page. Plan limits keep this to one or two requests. */
export async function getAllEmployees(): Promise<Employee[]> {
  const first = await getEmployees("size=100&sort=firstName&direction=ASC");
  const all = [...first.content];
  for (let page = 1; page < first.totalPages; page++) all.push(...(await getEmployees(`size=100&sort=firstName&direction=ASC&page=${page}`)).content);
  return all;
}

/**
 * Joins Payroll employee codes to Workforce records for display. Payroll stores only the code by design; the
 * Workforce API is scoped to the same organization and workspace, so no Payroll data is duplicated.
 */
export function useWorkforceDirectory(): WorkforceDirectory {
  const { workspace } = useWorkspace();
  const available = Boolean(workspace?.products.some((product) => product.key === "workforce"));
  const [state, setState] = useState({ loading: available, error: "", employees: [] as Employee[], departments: [] as Reference[], designations: [] as Reference[] });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!available) { setState({ loading: false, error: "", employees: [], departments: [], designations: [] }); return; }
    let current = true;
    setState((value) => ({ ...value, loading: true, error: "" }));
    Promise.all([getAllEmployees(), getDepartments(), getDesignations()])
      .then(([employees, departments, designations]) => { if (current) setState({ loading: false, error: "", employees, departments, designations }); })
      .catch((reason) => { if (current) setState({ loading: false, error: reason instanceof Error ? reason.message : "Unable to load employees", employees: [], departments: [], designations: [] }); });
    return () => { current = false; };
  }, [available, workspace?.key, revision]);
  const reload = useCallback(async () => setRevision((value) => value + 1), []);
  return useMemo(() => {
    const byCode = new Map(state.employees.map((employee) => [employee.employeeCode.toUpperCase(), employee]));
    const departments = new Map(state.departments.map((item) => [item.key, item.name]));
    const designations = new Map(state.designations.map((item) => [item.key, item.name]));
    const find = (code: string | null | undefined) => code ? byCode.get(code.toUpperCase()) : undefined;
    return {
      available, ...state, find, reload,
      nameOf: (code) => personName(find(code)) || (code ?? ""),
      departmentName: (key) => key ? departments.get(key) ?? key : "—",
      designationName: (key) => key ? designations.get(key) ?? key : "—",
    };
  }, [available, state, reload]);
}
