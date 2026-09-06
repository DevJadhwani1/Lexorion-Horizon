import { apiRequest } from "../../api/httpClient";
import type { Page } from "../../api/types";
export interface PayrollEmployee {
  employeeCode: string;
  status: "ACTIVE" | "INACTIVE";
  currency: string;
  payFrequency: "MONTHLY" | "BIWEEKLY" | "WEEKLY";
  effectiveFrom: string;
}
export interface Component {
  componentKey: string;
  displayName: string;
  category: "EARNING" | "DEDUCTION";
  amountType: "FIXED_AMOUNT" | "PERCENTAGE";
  occurrenceType: "RECURRING" | "ONE_TIME";
  taxability: "TAXABLE" | "NON_TAXABLE";
  status: "ACTIVE" | "INACTIVE";
}
export interface Assignment {
  componentKey: string;
  displayName: string;
  category: string;
  amountType: string;
  frequency: string;
  occurrenceType: string;
  taxability: string;
  value: number;
}
export interface Profile {
  employeeCode: string;
  profileKey: string;
  sourceTemplateKey: string | null;
  sourceTemplateVersion: number | null;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  components: Assignment[];
}
export interface CalculationLine {
  componentKey: string;
  displayName: string;
  category: string;
  amountType: string;
  occurrence: string;
  taxability: string;
  configuredValue: number;
  calculatedAmount: number;
  percentageBasis: string | null;
  currency: string;
}
export interface Calculation {
  employeeCode: string;
  calculationDate: string;
  currency: string;
  grossAmount: number;
  deductionAmount: number;
  netAmount: number;
  lines: CalculationLine[];
}
export interface PayRun {
  payRunKey: string;
  periodStart: string;
  periodEnd: string;
  calculationDate: string;
  currency: string;
  status: string;
  grossTotal: number;
  deductionTotal: number;
  netTotal: number;
  employeeCount: number;
  createdAt: string;
  finalizedAt: string | null;
}
export interface PayRunEmployee {
  employeeCode: string;
  grossAmount: number;
  deductionAmount: number;
  netAmount: number;
  currency: string;
  calculationDate: string;
}
export interface SalaryTemplateComponent {
  componentKey: string;
  displayName: string;
  category: string;
  amountType: string;
  occurrenceType: string;
  taxability: string;
  value: number;
}
export interface SalaryTemplate {
  templateKey: string;
  displayName: string;
  description: string | null;
  currency: string;
  payFrequency: string;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  components: SalaryTemplateComponent[];
  createdAt: string;
  updatedAt: string;
}
export type SalaryTemplateVersionStatus = "DRAFT" | "ACTIVE" | "INACTIVE";
export interface SalaryTemplateVersionComponent {
  componentKey: string;
  displayName: string;
  category: string;
  amountType: string;
  occurrenceType: string;
  taxability: string;
  value: number;
  percentageBasis: string | null;
  displaySequence: number;
}
export interface SalaryTemplateVersion {
  templateKey: string;
  versionNumber: number;
  currency: string;
  payFrequency: string;
  status: SalaryTemplateVersionStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  components: SalaryTemplateVersionComponent[];
  createdAt: string;
  updatedAt: string;
}
export interface LedgerEntry {
  employeeCode: string;
  payRunKey: string;
  periodStart: string;
  periodEnd: string;
  entryDate: string;
  type: string;
  componentKey: string | null;
  componentName: string | null;
  amount: number;
  currency: string;
  sourceReference: string;
  status: string;
  createdAt: string;
}
export interface PayslipLine {
  componentKey: string;
  displayName: string;
  category: string;
  amount: number;
}
export interface Payslip {
  employeeCode: string;
  payRunKey: string;
  periodStart: string;
  periodEnd: string;
  calculationDate: string;
  currency: string;
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  grossAmount: number;
  deductionAmount: number;
  netAmount: number;
  finalizedAt: string;
}
export const getPayrollEmployees = () =>
  apiRequest<PayrollEmployee[]>("/api/payroll/employees");
export const createPayrollEmployee = (body: unknown) =>
  apiRequest<PayrollEmployee>("/api/payroll/employees", {
    method: "POST",
    body,
  });
export const updatePayrollEmployee = (code: string, body: unknown) =>
  apiRequest<PayrollEmployee>(
    `/api/payroll/employees/${encodeURIComponent(code)}`,
    { method: "PATCH", body },
  );
export const getPayrollEmployee = (code: string) =>
  apiRequest<PayrollEmployee>(
    `/api/payroll/employees/${encodeURIComponent(code)}`,
  );
export const getComponents = () =>
  apiRequest<Component[]>("/api/payroll/components");
export const createComponent = (body: unknown) =>
  apiRequest<Component>("/api/payroll/components", { method: "POST", body });
export const updateComponent = (key: string, body: unknown) =>
  apiRequest<Component>(`/api/payroll/components/${encodeURIComponent(key)}`, {
    method: "PATCH",
    body,
  });
export const deactivateComponent = (key: string) =>
  apiRequest<Component>(`/api/payroll/components/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
export const getProfiles = (code: string) =>
  apiRequest<Profile[]>(
    `/api/payroll/employees/${encodeURIComponent(code)}/compensation`,
  );
export const createProfile = (code: string, body: unknown) =>
  apiRequest<Profile>(
    `/api/payroll/employees/${encodeURIComponent(code)}/compensation`,
    { method: "POST", body },
  );
export const getSalaryTemplates = () =>
  apiRequest<SalaryTemplate[]>("/api/payroll/salary-templates");
export const createSalaryTemplate = (body: unknown) =>
  apiRequest<SalaryTemplate>("/api/payroll/salary-templates", {
    method: "POST",
    body,
  });
export const updateSalaryTemplate = (key: string, body: unknown) =>
  apiRequest<SalaryTemplate>(
    `/api/payroll/salary-templates/${encodeURIComponent(key)}`,
    { method: "PATCH", body },
  );
export const deactivateSalaryTemplate = (key: string) =>
  apiRequest<SalaryTemplate>(
    `/api/payroll/salary-templates/${encodeURIComponent(key)}`,
    { method: "DELETE" },
  );
export const getSalaryTemplateVersions = (key: string) =>
  apiRequest<SalaryTemplateVersion[]>(
    `/api/payroll/salary-templates/${encodeURIComponent(key)}/versions`,
  );
export const createSalaryTemplateVersion = (key: string, body: unknown) =>
  apiRequest<SalaryTemplateVersion>(
    `/api/payroll/salary-templates/${encodeURIComponent(key)}/versions`,
    { method: "POST", body },
  );
export const updateSalaryTemplateVersion = (
  key: string,
  version: number,
  body: unknown,
) =>
  apiRequest<SalaryTemplateVersion>(
    `/api/payroll/salary-templates/${encodeURIComponent(key)}/versions/${version}`,
    { method: "PATCH", body },
  );
export const activateSalaryTemplateVersion = (key: string, version: number) =>
  apiRequest<SalaryTemplateVersion>(
    `/api/payroll/salary-templates/${encodeURIComponent(key)}/versions/${version}/activate`,
    { method: "POST" },
  );
export const deactivateSalaryTemplateVersion = (key: string, version: number) =>
  apiRequest<SalaryTemplateVersion>(
    `/api/payroll/salary-templates/${encodeURIComponent(key)}/versions/${version}/deactivate`,
    { method: "POST" },
  );
export const assignSalaryTemplate = (key: string, employeeCode: string, body: {
  profileKey: string;
  versionNumber: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}) =>
  apiRequest<Profile>(
    `/api/payroll/salary-templates/${encodeURIComponent(key)}/employees/${encodeURIComponent(employeeCode)}/compensation`,
    { method: "POST", body },
  );
export interface LedgerFilters {
  fromDate?: string;
  toDate?: string;
  payRunKey?: string;
  type?: string;
}
export const getLedger = (code: string, filters: LedgerFilters = {}) => {
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => Boolean(value)) as [
      string,
      string,
    ][],
  ).toString();
  return apiRequest<LedgerEntry[]>(
    `/api/payroll/employees/${encodeURIComponent(code)}/ledger${query ? `?${query}` : ""}`,
  );
};
export const getPayslips = (code: string) =>
  apiRequest<Payslip[]>(
    `/api/payroll/employees/${encodeURIComponent(code)}/payslips`,
  );
export const getPayslip = (code: string, run: string) =>
  apiRequest<Payslip>(
    `/api/payroll/employees/${encodeURIComponent(code)}/payslips/${encodeURIComponent(run)}`,
  );
export const getCalculations = (code: string) =>
  apiRequest<Calculation[]>(
    `/api/payroll/employees/${encodeURIComponent(code)}/calculations`,
  );
export const calculate = (code: string, date: string) =>
  apiRequest<Calculation>(
    `/api/payroll/employees/${encodeURIComponent(code)}/calculations`,
    { method: "POST", body: { calculationDate: date } },
  );
export const getPayRuns = (page = 0, size = 20) =>
  apiRequest<Page<PayRun>>(`/api/payroll/pay-runs?page=${page}&size=${size}`);
export const createPayRun = (body: unknown) =>
  apiRequest<PayRun>("/api/payroll/pay-runs", { method: "POST", body });
export const getPayRun = (key: string) =>
  apiRequest<PayRun>(`/api/payroll/pay-runs/${encodeURIComponent(key)}`);
export const getPayRunEmployees = (key: string) =>
  apiRequest<PayRunEmployee[]>(
    `/api/payroll/pay-runs/${encodeURIComponent(key)}/employees`,
  );
export const addPayRunEmployee = (key: string, employeeCode: string) =>
  apiRequest<PayRunEmployee>(
    `/api/payroll/pay-runs/${encodeURIComponent(key)}/employees`,
    { method: "POST", body: { employeeCode } },
  );
export const processPayRun = (key: string) =>
  apiRequest<PayRun>(
    `/api/payroll/pay-runs/${encodeURIComponent(key)}/process`,
    { method: "POST" },
  );
export const finalizePayRun = (key: string) =>
  apiRequest<PayRun>(
    `/api/payroll/pay-runs/${encodeURIComponent(key)}/finalize`,
    { method: "POST" },
  );
