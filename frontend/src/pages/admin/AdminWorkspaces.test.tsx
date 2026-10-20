import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminWorkspaces } from "./AdminWorkspaces";
import { setOrganizationWorkspaceProducts } from "../../features/admin/workspaceApi";
vi.mock("../../theme/ThemeProvider", () => ({ useTheme: () => ({ t: {} }) }));
vi.mock("../../workspace/WorkspaceProvider", () => ({ useWorkspace: () => ({ reload: vi.fn(async () => {}) }) }));
vi.mock("../../features/admin/workspaceApi", () => ({
  getProductCatalog: vi.fn(async () => [{ key: "workforce", displayName: "Workforce" }, { key: "payroll", displayName: "Payroll" }]),
  getOrganizationWorkspaces: vi.fn(async () => [{ key: "main", displayName: "Main", status: "ACTIVE", products: [{ key: "workforce" }, { key: "payroll" }] }]),
  createOrganizationWorkspace: vi.fn(), setOrganizationWorkspaceStatus: vi.fn(),
  setOrganizationWorkspaceProducts: vi.fn(async () => ({ key: "main", displayName: "Main", status: "ACTIVE", products: [{ key: "workforce" }] })),
}));
vi.mock("../../features/entitlements/entitlementApi", () => ({ getEffectiveEntitlements: vi.fn(async () => []), hasEntitlement: () => true, getEntitlementLimit: () => 3 }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("captures product selection before a React state updater replays the event", async () => {
  render(<StrictMode><AdminWorkspaces /></StrictMode>);
  const select = await screen.findByLabelText("Products for Main") as HTMLSelectElement;
  for (const option of select.options) option.selected = option.value === "workforce";
  fireEvent.change(select);
  fireEvent.click(screen.getByRole("button", { name: "Save products" }));
  await waitFor(() => expect(setOrganizationWorkspaceProducts).toHaveBeenCalledWith("main", ["workforce"]));
});
