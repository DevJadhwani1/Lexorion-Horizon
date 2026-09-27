import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkforcePage } from "./WorkforcePage";
import * as workforceApi from "../../features/workforce/workforceApi";

const employee = vi.hoisted(() => ({
  employeeCode: "EMP-001", firstName: "Ada", middleName: null, lastName: "Lovelace",
  workEmail: "ada@example.test", phone: null, joiningDate: "2026-01-01", status: "ACTIVE" as const,
  departmentKey: "engineering", designationKey: "developer", reportingManagerEmployeeCode: null,
}));
vi.mock("../../auth/AuthProvider", () => ({ useAuth: () => ({ organization: { membershipRole: "ADMIN" } }) }));
vi.mock("../../workspace/WorkspaceProvider", () => ({ useWorkspace: () => ({ workspace: { products: [{ key: "workforce" }, { key: "payroll" }] } }) }));
vi.mock("../../features/workforce/workforceApi", async (load) => {
  const actual = await load<typeof import("../../features/workforce/workforceApi")>();
  return { ...actual, getEmployee: vi.fn(async () => employee), getEmployeeHistory: vi.fn(async () => []), updateEmployee: vi.fn(async () => employee) };
});

beforeEach(() => { vi.mocked(workforceApi.getEmployee).mockResolvedValue(employee); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("employee profile editing", () => {
  it("sends explicit nulls when an admin clears optional department and designation", async () => {
    render(<MemoryRouter initialEntries={["/workforce/employees/EMP-001"]}><Routes><Route path="/workforce/employees/:employeeCode" element={<WorkforcePage />} /></Routes></MemoryRouter>);
    await screen.findByText("Ada Lovelace");
    expect(screen.getByRole("link", { name: "View compensation in Payroll" }).getAttribute("href")).toContain("employee=EMP-001");
    fireEvent.click(screen.getByText("Edit employee"));
    fireEvent.change(screen.getByLabelText("department Key"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("designation Key"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save employee" }));
    await waitFor(() => expect(workforceApi.updateEmployee).toHaveBeenCalledWith("EMP-001", expect.objectContaining({ departmentKey: null, designationKey: null })));
  });
});
