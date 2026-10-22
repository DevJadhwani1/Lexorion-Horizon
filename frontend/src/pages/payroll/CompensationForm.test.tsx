import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CompensationForm, componentKeyFromName, estimatePay, splitAnnualGross } from "./CompensationForm";
import * as payrollApi from "../../features/payroll/payrollApi";
import { ApiError } from "../../api/types";
import { chooseOption } from "../../test/dropdown";

vi.mock("../../features/payroll/payrollApi", () => ({ getComponents: vi.fn(), createComponent: vi.fn(), createProfile: vi.fn(), getStatutoryEstimate: vi.fn() }));
type C = payrollApi.Component;
const component = (componentKey: string, displayName: string, category: C["category"], amountType: C["amountType"] = "FIXED_AMOUNT", occurrenceType: C["occurrenceType"] = "RECURRING"): C =>
  ({ componentKey, displayName, category, amountType, occurrenceType, taxability: "TAXABLE", status: "ACTIVE" });
const components = [component("BASIC", "Basic salary", "EARNING"), component("HRA", "House rent allowance", "EARNING", "PERCENTAGE"),
  component("PF_EMPLOYEE", "PF (employee)", "DEDUCTION"), component("PF_EMPLOYER", "PF (employer)", "EMPLOYER_CONTRIBUTION"),
  component("BONUS", "Bonus", "EARNING", "FIXED_AMOUNT", "ONE_TIME")];
const employee = { employeeCode: "EMP-1", status: "ACTIVE" as const, currency: "INR", payFrequency: "MONTHLY" as const, effectiveFrom: "2026-10-01" };

beforeEach(() => { vi.mocked(payrollApi.getComponents).mockResolvedValue(components); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

async function addComponent(name: RegExp, value: string, label: string) {
  fireEvent.click(await screen.findByRole("button", { name: "＋ Add pay component" }));
  chooseOption("Pay component", name);
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

it("separates employer contributions from deductions in the estimate", () => {
  const values = { BASIC: "30000", HRA: "40", PF_EMPLOYEE: "1800", PF_EMPLOYER: "1800", BONUS: "5000" };
  expect(estimatePay(components, values)).toEqual({ gross: 42000, deductions: 1800, net: 40200, employer: 1800, employerCost: 43800 });
});

it("derives valid payroll component keys from names", () => {
  expect(componentKeyFromName("Conveyance allowance")).toBe("CONVEYANCE_ALLOWANCE");
  expect(componentKeyFromName("13th month pay")).toBe("C_13TH_MONTH_PAY");
});

it("builds a salary line by line with a live breakdown and never adds a component twice", async () => {
  vi.mocked(payrollApi.createProfile).mockResolvedValue({} as payrollApi.Profile);
  const onSaved = vi.fn();
  render(<CompensationForm employee={employee} profiles={[]} onSaved={onSaved} locale="en-IN" />);
  await addComponent(/Basic salary/, "30000", "Basic salary amount in INR");
  await addComponent(/House rent allowance/, "40", "House rent allowance percentage");
  await addComponent(/PF \(employee\)/, "1800", "PF (employee) amount in INR");
  await addComponent(/PF \(employer\)/, "1800", "PF (employer) amount in INR");
  const breakdown = screen.getByLabelText("Estimated pay");
  const value = (term: string) => within(breakdown).getByText(term).nextElementSibling?.textContent;
  expect(value("Gross earnings")).toBe("₹42,000.00");
  expect(value("Employee deductions")).toBe("₹1,800.00");
  expect(value("Estimated net pay")).toBe("₹40,200.00");
  expect(value("Employer contributions")).toBe("₹1,800.00");
  expect(value("Employer cost")).toBe("₹43,800.00");
  expect(breakdown.textContent).toContain("not deducted unless you add them");
  expect(screen.getByLabelText("House rent allowance per month").textContent).toBe("₹12,000.00");

  fireEvent.click(screen.getByRole("button", { name: "＋ Add pay component" }));
  fireEvent.click(screen.getByRole("combobox", { name: "Pay component" }));
  expect(within(screen.getByRole("listbox", { name: "Pay component" })).queryByRole("option", { name: /Basic salary/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  fireEvent.click(screen.getByRole("button", { name: "Remove PF (employer)" }));
  expect(value("Employer contributions")).toBe("₹0.00");
  fireEvent.click(screen.getByRole("button", { name: "Save salary" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(payrollApi.createProfile).toHaveBeenCalledWith("EMP-1", expect.objectContaining({
    components: [{ componentKey: "BASIC", value: 30000 }, { componentKey: "HRA", value: 40 }, { componentKey: "PF_EMPLOYEE", value: 1800 }] }));
});

it("blocks saving when deductions exceed earnings or values are missing", async () => {
  render(<CompensationForm employee={employee} profiles={[]} onSaved={vi.fn()} />);
  await addComponent(/Basic salary/, "1000", "Basic salary amount in INR");
  await addComponent(/PF \(employee\)/, "2000", "PF (employee) amount in INR");
  expect(screen.getByText(/Deductions are more than gross earnings/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Save salary" }));
  expect(payrollApi.createProfile).not.toHaveBeenCalled();
});

it("creates a new component once and reuses it if it already exists", async () => {
  vi.mocked(payrollApi.createComponent).mockRejectedValue(new ApiError(409, "Compensation component already exists"));
  vi.mocked(payrollApi.getComponents).mockResolvedValueOnce(components).mockResolvedValue([...components, component("CONVEYANCE_ALLOWANCE", "Conveyance allowance", "EARNING")]);
  render(<CompensationForm employee={employee} profiles={[]} onSaved={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "＋ Add pay component" }));
  chooseOption("Pay component", /Create a new pay component/);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Conveyance allowance" } });
  chooseOption("Category", /Employer contribution/);
  chooseOption("Category", /^Earning/);
  fireEvent.click(screen.getByRole("button", { name: "Create and add" }));
  expect(await screen.findByLabelText("Conveyance allowance amount in INR")).toBeTruthy();
  expect(payrollApi.createComponent).toHaveBeenCalledWith(expect.objectContaining({ componentKey: "CONVEYANCE_ALLOWANCE", category: "EARNING", status: "ACTIVE" }));
});

it("shows the EPF and ESI estimate as guidance with its status and source, without adding it to the salary", async () => {
  vi.mocked(payrollApi.getStatutoryEstimate).mockResolvedValue({
    employeeCode: "EMP-1", asOf: "2026-10-01", currency: "INR", pfWages: 30000, esiWages: 42000, employeeDeductionTotal: 3000, employerContributionTotal: 3000,
    lines: [{ scheme: "EPF", label: "Employee PF contribution", party: "EMPLOYEE", amount: 3000, status: "ESTIMATED", note: "12% on PF wages of ₹25,000.00 (capped)." },
      { scheme: "TDS", label: "Income-tax (TDS on salary)", party: "EMPLOYEE", amount: null, status: "UNAVAILABLE", note: "Not calculated." }],
    sources: [{ scheme: "EPF", effectiveFrom: "2026-09-17", effectiveTo: null, reference: "S.O. 5109(E)", url: "https://www.pib.gov.in/", reviewStatus: "REQUIRES_EMPLOYER_REVIEW" }],
    warnings: [],
  });
  render(<CompensationForm employee={employee} profiles={[]} onSaved={vi.fn()} locale="en-IN" />);
  await addComponent(/Basic salary/, "30000", "Basic salary amount in INR");
  fireEvent.click(screen.getByRole("button", { name: "Estimate EPF and ESI" }));
  expect(await screen.findByText("Not calculated")).toBeTruthy();
  expect(payrollApi.getStatutoryEstimate).toHaveBeenCalledWith("EMP-1", { asOf: "2026-10-01", basicWages: 30000, grossWages: 30000 });
  expect(screen.getByText(/Review with your payroll adviser/)).toBeTruthy();
  expect(within(screen.getByLabelText("Estimated pay")).getByText("Employee deductions").nextElementSibling?.textContent).toBe("₹0.00");
});

it("splits an annual gross into basic, HRA and special allowance that add up to the monthly gross", () => {
  expect(splitAnnualGross(600000, false)).toEqual({ monthly: 50000, BASIC: 25000, HRA: 10000, SPECIAL_ALLOWANCE: 15000 });
  expect(splitAnnualGross(600000, true)).toEqual({ monthly: 50000, BASIC: 25000, HRA: 12500, SPECIAL_ALLOWANCE: 12500 });
  const odd = splitAnnualGross(500001, false);
  expect(odd.BASIC + odd.HRA + odd.SPECIAL_ALLOWANCE).toBeCloseTo(odd.monthly, 2);
});

it("creates the standard components when missing and fills the salary from annual gross", async () => {
  const standard = [component("BASIC", "Basic salary", "EARNING"), component("HRA", "House rent allowance", "EARNING"),
    component("SPECIAL_ALLOWANCE", "Special allowance", "EARNING"), component("PF_EMPLOYEE", "Provident fund (employee)", "DEDUCTION"),
    component("PROFESSIONAL_TAX", "Professional tax", "DEDUCTION"), component("PF_EMPLOYER", "Provident fund (employer)", "EMPLOYER_CONTRIBUTION")];
  vi.mocked(payrollApi.getComponents).mockResolvedValueOnce([]).mockResolvedValue(standard);
  vi.mocked(payrollApi.createComponent).mockResolvedValue(standard[0]);
  render(<CompensationForm employee={employee} profiles={[]} onSaved={vi.fn()} locale="en-IN" />);
  fireEvent.change(await screen.findByLabelText("Annual gross salary"), { target: { value: "600000" } });
  fireEvent.click(screen.getByRole("button", { name: "Fill salary lines" }));
  expect(await screen.findByLabelText("Basic salary per month")).toBeTruthy();
  expect(payrollApi.createComponent).toHaveBeenCalledTimes(6);
  expect(payrollApi.createComponent).toHaveBeenCalledWith(expect.objectContaining({ componentKey: "HRA", amountType: "FIXED_AMOUNT", status: "ACTIVE" }));
  expect(screen.getByLabelText("Basic salary per month").textContent).toBe("₹25,000.00");
  expect(screen.getByLabelText("House rent allowance per month").textContent).toBe("₹10,000.00");
  expect(screen.getByLabelText("Special allowance per month").textContent).toBe("₹15,000.00");
});
