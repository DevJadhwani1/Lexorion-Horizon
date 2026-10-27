import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminWorkspaces } from "./AdminWorkspaces";
import {
  createOrganizationWorkspace,
  getOrganizationWorkspaces,
  setOrganizationWorkspaceStatus,
} from "../../features/admin/workspaceApi";
import { getEffectiveEntitlements, type EffectiveEntitlements } from "../../features/entitlements/entitlementApi";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockReload = vi.fn(async () => {});
const mockSelectWorkspace = vi.fn();
const mockRememberWorkspace = vi.fn();

vi.mock("../../theme/ThemeProvider", () => ({ useTheme: () => ({ t: {} }) }));
vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({
    organization: { slug: "alpha", organizationName: "Alpha" },
    rememberWorkspace: mockRememberWorkspace,
  }),
}));
vi.mock("../../workspace/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    reload: mockReload,
    selectWorkspace: mockSelectWorkspace,
    workspace: null,
  }),
}));

vi.mock("../../features/admin/workspaceApi", () => ({
  getProductCatalog: vi.fn(async () => [
    { key: "workforce", displayName: "Workforce" },
    { key: "payroll", displayName: "Payroll" },
  ]),
  getOrganizationWorkspaces: vi.fn(async () => [
    {
      key: "main",
      displayName: "Main HR",
      status: "ACTIVE",
      products: [
        { key: "workforce", displayName: "Workforce" },
        { key: "payroll", displayName: "Payroll" },
      ],
    },
  ]),
  createOrganizationWorkspace: vi.fn(async () => ({
    key: "operations",
    displayName: "Operations",
    status: "ACTIVE",
    products: [{ key: "workforce", displayName: "Workforce" }],
  })),
  setOrganizationWorkspaceStatus: vi.fn(async (key, status) => ({
    key,
    displayName: "Main HR",
    status,
    products: [{ key: "workforce", displayName: "Workforce" }],
  })),
  setOrganizationWorkspaceProducts: vi.fn(),
}));

const defaultEntitlementSnapshot: EffectiveEntitlements = [
  {
    productKey: "organization",
    planKey: "starter",
    planName: "Starter",
    entitlements: [
      { key: "workforce.enabled", valueType: "BOOLEAN", booleanValue: true, integerValue: null },
      { key: "payroll.enabled", valueType: "BOOLEAN", booleanValue: true, integerValue: null },
      { key: "platform.workspace_limit", valueType: "INTEGER", booleanValue: null, integerValue: 3 },
    ],
  },
];

vi.mock("../../features/entitlements/entitlementApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../features/entitlements/entitlementApi")>();
  return {
    ...actual,
    getEffectiveEntitlements: vi.fn(),
    getEntitlementLimit: () => 3,
  };
});

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.mocked(getEffectiveEntitlements).mockResolvedValue(defaultEntitlementSnapshot);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("creates a workspace requesting minimum information and continues to operational overview", async () => {
  render(
    <StrictMode>
      <MemoryRouter>
        <AdminWorkspaces />
      </MemoryRouter>
    </StrictMode>
  );

  await screen.findByText("Main HR");
  fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Operations" } });
  expect((screen.getByLabelText("Workspace key") as HTMLInputElement).value).toBe("operations");

  // Verify internal product selection dropdown is NOT exposed
  expect(screen.queryByLabelText("Enabled products")).toBeNull();
  expect(screen.queryByLabelText(/Products for/)).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
  await waitFor(() =>
    expect(createOrganizationWorkspace).toHaveBeenCalledWith({
      key: "operations",
      displayName: "Operations",
      productKeys: ["workforce", "payroll"],
    })
  );
  // Selection happens inside the provider from the refreshed list (see WorkspaceProvider.test).
  await waitFor(() => expect(mockReload).toHaveBeenCalledWith({ select: "operations" }));
  expect(mockSelectWorkspace).not.toHaveBeenCalled();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/overview"));
});

it("shows useful list with capabilities and permitted management actions", async () => {
  render(
    <StrictMode>
      <MemoryRouter>
        <AdminWorkspaces />
      </MemoryRouter>
    </StrictMode>
  );

  await screen.findByText("Main HR");
  expect(screen.getByText("main")).toBeTruthy();

  // Capabilities badges displayed from workspace products
  expect(screen.getByText("Workforce")).toBeTruthy();
  expect(screen.getByText("Payroll")).toBeTruthy();

  // Status badge
  expect(screen.getByText("ACTIVE")).toBeTruthy();

  expect(screen.getByRole("button", { name: "Add Finance" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Remove Finance" })).toBeNull();

  // Permitted management action: Deactivate
  const actionButton = screen.getByRole("button", { name: "Deactivate" });
  fireEvent.click(actionButton);
  await waitFor(() => expect(setOrganizationWorkspaceStatus).toHaveBeenCalledWith("main", "INACTIVE"));
});

it("does not offer to remove Finance once it is attached", async () => {
  vi.mocked(getOrganizationWorkspaces).mockResolvedValue([
    {
      key: "main",
      displayName: "Main HR",
      status: "ACTIVE",
      productKey: "workforce",
      productName: "Workforce",
      products: [
        { key: "workforce", displayName: "Workforce" },
        { key: "finance", displayName: "Finance" },
      ],
    },
  ]);

  render(
    <StrictMode>
      <MemoryRouter>
        <AdminWorkspaces />
      </MemoryRouter>
    </StrictMode>
  );

  await screen.findByText("Finance");
  expect(screen.queryByRole("button", { name: "Remove Finance" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Add Finance" })).toBeNull();
});

it("explains when no active plan is available and offers safe retry recovery path", async () => {
  vi.mocked(getEffectiveEntitlements).mockResolvedValue([] as EffectiveEntitlements);

  render(
    <StrictMode>
      <MemoryRouter>
        <AdminWorkspaces />
      </MemoryRouter>
    </StrictMode>
  );

  expect((await screen.findByRole("status")).textContent).toContain("No active organization plan is assigned");
  expect((screen.getByRole("button", { name: "Create workspace" }) as HTMLButtonElement).disabled).toBe(true);

  // Recovery action button is available
  const retryBtn = screen.getByRole("button", { name: "Retry plan check" });
  expect(retryBtn).toBeTruthy();

  vi.mocked(getEffectiveEntitlements).mockResolvedValue(defaultEntitlementSnapshot);
  fireEvent.click(retryBtn);
  await waitFor(() => expect(screen.queryByText("No active organization plan is assigned")).toBeNull());
});

it("validates workspace key uniqueness against existing workspaces", async () => {
  render(
    <StrictMode>
      <MemoryRouter>
        <AdminWorkspaces />
      </MemoryRouter>
    </StrictMode>
  );

  await screen.findByText("Main HR");
  fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Duplicate HR" } });
  fireEvent.change(screen.getByLabelText("Workspace key"), { target: { value: "main" } });

  fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("alert").textContent).toContain("Workspace key already exists in this organization: main");
  expect(createOrganizationWorkspace).not.toHaveBeenCalled();
});

it("retains form input when workspace creation fails for user retry", async () => {
  vi.mocked(createOrganizationWorkspace).mockRejectedValueOnce(new Error("Network timeout creating workspace"));

  render(
    <StrictMode>
      <MemoryRouter>
        <AdminWorkspaces />
      </MemoryRouter>
    </StrictMode>
  );

  await screen.findByText("Main HR");
  fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Retry Unit" } });
  expect((screen.getByLabelText("Workspace key") as HTMLInputElement).value).toBe("retry-unit");

  fireEvent.click(screen.getByRole("button", { name: "Create workspace" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("alert").textContent).toContain("Network timeout creating workspace");

  // Input fields retain user values so customer doesn't lose typed data
  expect((screen.getByLabelText("Display name") as HTMLInputElement).value).toBe("Retry Unit");
  expect((screen.getByLabelText("Workspace key") as HTMLInputElement).value).toBe("retry-unit");
});
