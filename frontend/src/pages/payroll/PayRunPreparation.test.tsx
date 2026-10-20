import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PayRunPreparation } from "./PayRunPreparation";
import * as api from "../../features/payroll/payrollApi";
vi.mock("../../features/payroll/payrollApi", () => ({ getPayRunPreparation: vi.fn(), savePayRunPreparation: vi.fn() }));
const run = { payRunKey: "PREP", periodStart: "2026-10-01", periodEnd: "2026-10-31", calculationDate: "2026-10-31", currency: "USD", status: "DRAFT" } as api.PayRun;
const report: api.PayRunPreparation = { ...run, employeeCount: 2, eligibleCount: 1, blockedCount: 1, selectedCount: 0, selectedBlockedCount: 0, ready: false, issues: [], employees: [
  { employeeCode: "GOOD", eligible: true, selected: false, blockedReason: null },
  { employeeCode: "MISSING", eligible: false, selected: false, blockedReason: "No effective compensation profile" },
] };
const process = vi.fn(), saved = vi.fn(async () => {});
function view() { return render(<MemoryRouter><PayRunPreparation run={run} busy={false} onProcess={process} onSaved={saved} /></MemoryRouter>); }
beforeEach(() => { vi.mocked(api.getPayRunPreparation).mockResolvedValue(report); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("shows backend reasons and counts, saves explicit selection before enabling process", async () => {
  vi.mocked(api.savePayRunPreparation).mockResolvedValue({ ...report, selectedCount: 1, ready: true, employees: [{ ...report.employees[0], selected: true }, report.employees[1]] });
  view();
  await screen.findByText("No effective compensation profile");
  expect(screen.getByLabelText("Preparation counts").textContent).toContain("2 payroll employees · 1 eligible · 1 blocked · 0 selected");
  expect(screen.getByRole("checkbox", { name: "Select MISSING" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Process" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: "Select GOOD" }));
  expect(screen.getByRole("button", { name: "Process" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Save selection" }));
  await screen.findByText("Ready to calculate");
  expect(api.savePayRunPreparation).toHaveBeenCalledWith("PREP", ["GOOD"]);
  fireEvent.click(screen.getByRole("button", { name: "Process" })); expect(process).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("checkbox", { name: "Select GOOD" }));
  expect(screen.getByRole("button", { name: "Process" }).hasAttribute("disabled")).toBe(true);
});
it("allows removing a previously included blocked employee", async () => {
  vi.mocked(api.getPayRunPreparation).mockResolvedValue({ ...report, selectedCount: 1, selectedBlockedCount: 1, employees: [report.employees[0], { ...report.employees[1], selected: true }] });
  view(); await screen.findByText("No effective compensation profile");
  const checkbox = screen.getByRole("checkbox", { name: "Select MISSING" });
  expect(checkbox.hasAttribute("disabled")).toBe(false);
  fireEvent.click(checkbox);
  expect(screen.getByRole("button", { name: "Save selection" }).hasAttribute("disabled")).toBe(false);
});
it("keeps processing blocked after a save failure and offers fresh validation", async () => {
  vi.mocked(api.savePayRunPreparation).mockRejectedValue(new Error("Employee already has a calculated or finalized pay run overlapping this period"));
  view(); await screen.findByText("GOOD");
  fireEvent.click(screen.getByRole("checkbox", { name: "Select GOOD" }));
  fireEvent.click(screen.getByRole("button", { name: "Save selection" }));
  await screen.findByText(/Employee already has/);
  expect(screen.getByRole("button", { name: "Process" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Refresh validation" }));
  await waitFor(() => expect(api.getPayRunPreparation).toHaveBeenCalledTimes(2));
});
it("shows useful empty and unavailable states without enabling process", async () => {
  vi.mocked(api.getPayRunPreparation).mockRejectedValueOnce(new Error("Payroll unavailable"));
  view(); await screen.findByText(/Payroll unavailable/);
  expect(screen.queryByRole("button", { name: "Process" })).toBeNull();
  vi.mocked(api.getPayRunPreparation).mockResolvedValue({ ...report, employeeCount: 0, eligibleCount: 0, blockedCount: 0, employees: [] });
  fireEvent.click(screen.getByRole("button", { name: "Refresh validation" }));
  await screen.findByText(/No payroll employees in this workspace/);
  expect(screen.getByRole("link", { name: "Configure payroll employees" })).toBeTruthy();
});
it("ignores a delayed response after opening another run", async () => {
  let release!: (value: api.PayRunPreparation) => void;
  vi.mocked(api.getPayRunPreparation).mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
  const result = view();
  result.rerender(<MemoryRouter><PayRunPreparation run={{ ...run, payRunKey: "OTHER" }} busy={false} onProcess={process} onSaved={saved} /></MemoryRouter>);
  await screen.findByText("GOOD");
  release({ ...report, employees: [{ employeeCode: "STALE", eligible: true, selected: true, blockedReason: null }] });
  await waitFor(() => expect(screen.queryByText("STALE")).toBeNull());
});
