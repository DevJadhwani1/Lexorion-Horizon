import { expect, it } from "vitest";
import { formatDate, formatMoney, humanize, keyFromName } from "./format";
import { suggestEmployeeCode } from "../pages/workforce/EmployeeFields";
import { estimatePay, nextProfileKey } from "../pages/payroll/CompensationForm";
import { monthPeriod, suggestedPayMonth } from "../pages/payroll/PayrollPage";
import type { Component, PayRun, Profile } from "../features/payroll/payrollApi";

it("turns API names into readable labels", () => {
  expect(humanize("ON_LEAVE")).toBe("On leave");
  expect(humanize("reportingManagerEmployeeCode")).toBe("Reporting manager employee code");
  expect(keyFromName("Research & Development")).toBe("research-development");
});

it("formats ISO dates without time-zone drift and money with the given currency", () => {
  expect(formatDate("2026-10-31")).toBe("31 Oct 2026");
  expect(formatMoney(378000, "INR", "en-IN")).toBe("₹3,78,000.00");
  expect(formatMoney(5, "NOTACURRENCY")).toBe("5.00 NOTACURRENCY");
});

it("suggests the next unused employee code in the existing pattern", () => {
  expect(suggestEmployeeCode([])).toBe("EMP-001");
  expect(suggestEmployeeCode(["EMP-001", "EMP-009", "X-1"])).toBe("EMP-010");
  expect(suggestEmployeeCode(["A1", "A2", "A0003"])).toBe("A0004");
});

it("estimates recurring pay in the calculator's order", () => {
  const component = (componentKey: string, category: Component["category"], amountType: Component["amountType"], occurrenceType: Component["occurrenceType"] = "RECURRING"): Component =>
    ({ componentKey, displayName: componentKey, category, amountType, occurrenceType, taxability: "TAXABLE", status: "ACTIVE" });
  const components = [component("BASIC", "EARNING", "FIXED_AMOUNT"), component("HRA", "EARNING", "PERCENTAGE"), component("PF", "DEDUCTION", "PERCENTAGE"), component("BONUS", "EARNING", "FIXED_AMOUNT", "ONE_TIME")];
  expect(estimatePay(components, { BASIC: "1000", HRA: "50", PF: "10", BONUS: "999" })).toEqual({ gross: 1500, deductions: 150, net: 1350 });
});

it("generates profile keys that do not collide", () => {
  expect(nextProfileKey("2026-10-01", [{ profileKey: "SAL-20261001" } as Profile])).toBe("SAL-20261001-2");
});

it("derives monthly pay periods and the next month to pay", () => {
  expect(monthPeriod("2028-02")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  expect(suggestedPayMonth([{ periodEnd: "2026-09-30" } as PayRun, { periodEnd: "2026-08-31" } as PayRun])).toBe("2026-10");
  expect(suggestedPayMonth([], new Date("2026-12-15T00:00:00Z"))).toBe("2026-12");
});
