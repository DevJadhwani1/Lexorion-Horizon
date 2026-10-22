import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PayrollSetupStep } from "./PayrollSetupStep";
import * as payrollApi from "../../features/payroll/payrollApi";
import { chooseOption } from "../../test/dropdown";

vi.mock("../../features/payroll/payrollApi", () => ({ createPayrollEmployee: vi.fn(), updatePayrollEmployee: vi.fn(), saveStatutoryProfile: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

const employee = { employeeCode: "EMP-1", firstName: "Ada", middleName: null, lastName: "Lovelace", workEmail: "ada@example.test", phone: null, joiningDate: "2026-10-01", status: "ACTIVE" as const, departmentKey: null, designationKey: null, reportingManagerEmployeeCode: null };
const profile: payrollApi.StatutoryProfile = {
  paymentMethod: "BANK_TRANSFER", bankAccountHolder: "Ada Lovelace", bankAccountNumberMasked: "••••6789", bankIfsc: "HDFC0001234", bankName: null, bankVerified: true,
  panMasked: "••••234F", panVerified: true, taxRegime: "NEW", pfApplicability: "APPLICABLE", uanMasked: "••••0001", pfMemberSince: null, pfHigherWagesOptIn: false, pfVerified: false,
  esiApplicability: "NOT_APPLICABLE", esiIpNumberMasked: null, esiVerified: false, ptApplicability: "UNDECIDED", ptState: null, lwfApplicability: "UNDECIDED", lwfState: null,
};
const setup: payrollApi.PayrollSetup = {
  enrollment: { employeeCode: "EMP-1", status: "ACTIVE", currency: "INR", payFrequency: "MONTHLY", effectiveFrom: "2026-10-01" },
  statutoryProfile: profile, salaryConfigured: false,
  sections: [{ key: "payment", title: "Payment method", status: "COMPLETE", missing: [] }, { key: "tax", title: "PAN and tax regime", status: "COMPLETE", missing: [] }],
  readiness: { readyForPayroll: false, setupComplete: false, blockers: [], warnings: [] },
};

it("shows saved identifiers masked, never pre-fills them, and only sends values the admin typed", async () => {
  vi.mocked(payrollApi.saveStatutoryProfile).mockResolvedValue(setup);
  vi.mocked(payrollApi.updatePayrollEmployee).mockResolvedValue(setup.enrollment);
  const onSaved = vi.fn();
  render(<PayrollSetupStep employee={employee} setup={setup} defaultCurrency="INR" onSaved={onSaved} onSkip={vi.fn()} onFinishLater={vi.fn()} />);
  const account = screen.getByLabelText("Account number") as HTMLInputElement;
  expect(account.value).toBe("");
  expect(screen.getByText("Saved: ••••6789. Leave blank to keep it.")).toBeTruthy();
  expect((screen.getByLabelText("PAN") as HTMLInputElement).value).toBe("");
  expect(document.body.innerHTML).not.toMatch(/ABCDE|000123456789/);
  expect(screen.queryByRole("button", { name: "Skip payroll for now" })).toBeNull();

  // Replacing the PAN clears its verification; the untouched account keeps its verification.
  fireEvent.change(screen.getByLabelText("PAN"), { target: { value: "ABCDE1234F" } });
  expect((screen.getByLabelText(/PAN verified/) as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  const body = vi.mocked(payrollApi.saveStatutoryProfile).mock.calls[0][1];
  expect(body).toMatchObject({ pan: "ABCDE1234F", panVerified: false, bankVerified: true, paymentMethod: "BANK_TRANSFER", pfApplicability: "APPLICABLE", esiApplicability: "NOT_APPLICABLE" });
  expect(body).not.toHaveProperty("bankAccountNumber");
  expect(body).not.toHaveProperty("uan");
  expect(payrollApi.createPayrollEmployee).not.toHaveBeenCalled();
});

it("creates the enrollment for a new payroll employee and asks for a state only when a state scheme applies", async () => {
  vi.mocked(payrollApi.createPayrollEmployee).mockResolvedValue(setup.enrollment);
  vi.mocked(payrollApi.updatePayrollEmployee).mockResolvedValue(setup.enrollment);
  vi.mocked(payrollApi.saveStatutoryProfile).mockResolvedValue(setup);
  const onFinishLater = vi.fn();
  render(<PayrollSetupStep employee={employee} setup={null} defaultCurrency="INR" onSaved={vi.fn()} onSkip={vi.fn()} onFinishLater={onFinishLater} />);
  expect(screen.queryByLabelText("Account number")).toBeNull();
  expect(screen.queryByRole("combobox", { name: "Professional tax state" })).toBeNull();
  chooseOption("Professional tax", "Applies");
  chooseOption("Professional tax state", /Maharashtra/);
  fireEvent.click(screen.getByRole("button", { name: "Save and review" }));
  await waitFor(() => expect(onFinishLater).toHaveBeenCalled());
  expect(payrollApi.createPayrollEmployee).toHaveBeenCalledWith(expect.objectContaining({ employeeCode: "EMP-1", currency: "INR", effectiveFrom: "2026-10-01" }));
  expect(payrollApi.saveStatutoryProfile).toHaveBeenCalledWith("EMP-1", expect.objectContaining({ ptApplicability: "APPLICABLE", ptState: "MH" }));
});
