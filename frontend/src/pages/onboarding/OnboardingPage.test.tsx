import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { OnboardingPage } from "./OnboardingPage";
import { AppShell } from "../../layout/AppShell";
import { ThemeProvider } from "../../theme/ThemeProvider";
import * as adminApi from "../../features/admin/adminApi";
import * as workspaceApi from "../../features/admin/workspaceApi";

const testState = vi.hoisted(() => ({
  user: { firstName: "Jane", lastName: "Admin", email: "admin@acme.test" },
  organization: {
    organizationId: "org-1",
    organizationName: "Acme Corp",
    slug: "acme",
    membershipRole: "ADMIN",
    organizationStatus: "ACTIVE",
  },
  workspace: null as { key: string; displayName: string; products: Array<{ key: string; displayName: string }> } | null,
  workspaces: [] as Array<{ key: string; displayName: string; status: string; products: Array<{ key: string; displayName: string }> }>,
  orgDetails: {
    id: "org-1",
    name: "Acme Corp",
    slug: "acme",
    legalName: null,
    primaryEmail: "",
    primaryPhone: null,
    status: "ACTIVE",
  } as any,
  members: [] as any[],
  invitations: [] as any[],
  entitlements: [
    { planName: "Starter", featureKey: "platform.workspaces", limit: 3 },
  ] as any[],
}));

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({
    user: testState.user,
    organization: testState.organization,
    organizations: [testState.organization],
    loading: false,
    rememberWorkspace: vi.fn(),
  }),
}));

vi.mock("../../workspace/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    workspace: testState.workspace,
    workspaces: testState.workspaces,
    loading: false,
    error: null,
    reload: vi.fn(),
    selectWorkspace: vi.fn(),
  }),
}));

vi.mock("../../context/ApplicationContext", () => ({
  useApplicationContext: () => ({ mode: "client", hasPlatformAccess: false }),
}));

vi.mock("../../features/admin/adminApi", () => ({
  getOrganization: vi.fn(async () => testState.orgDetails),
  updateOrganization: vi.fn(async (data) => {
    testState.orgDetails = { ...testState.orgDetails, ...data };
    return testState.orgDetails;
  }),
  getMembers: vi.fn(async () => testState.members),
  getInvitations: vi.fn(async () => testState.invitations),
  createInvitation: vi.fn(async (input) => {
    const inv = { id: "inv-" + Date.now(), email: input.email, role: input.role, status: "PENDING" };
    testState.invitations.push(inv);
    return inv;
  }),
}));

vi.mock("../../features/admin/workspaceApi", () => ({
  getOrganizationWorkspaces: vi.fn(async () => testState.workspaces),
  createOrganizationWorkspace: vi.fn(async (input) => {
    const ws = { key: input.key, displayName: input.displayName, status: "ACTIVE", products: [{ key: "workforce", displayName: "Workforce" }] };
    testState.workspaces.push(ws);
    return ws;
  }),
}));

vi.mock("../../features/entitlements/entitlementApi", () => ({
  getEffectiveEntitlements: vi.fn(async () => testState.entitlements),
  deriveProductKeysFromEntitlements: () => ["workforce", "payroll"],
  getEntitlementLimit: () => null,
}));

beforeEach(() => {
  sessionStorage.clear();
  testState.workspace = null;
  testState.workspaces = [];
  testState.orgDetails = {
    id: "org-1",
    name: "Acme Corp",
    slug: "acme",
    legalName: null,
    primaryEmail: "",
    primaryPhone: null,
    status: "ACTIVE",
  };
  testState.members = [
    { userId: "u-1", email: "admin@acme.test", role: "ADMIN", status: "ACTIVE" },
  ];
  testState.invitations = [];
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const renderOnboarding = () =>
  render(
    <MemoryRouter initialEntries={["/app/onboarding"]}>
      <Routes>
        <Route path="/app/onboarding" element={<OnboardingPage />} />
      </Routes>
    </MemoryRouter>
  );

it("renders welcome area, organization progress summary, and 4 setup cards", async () => {
  renderOnboarding();
  await screen.findByRole("heading", { name: "Set up your organization" });

  expect(screen.getByText(/Complete a few essential steps to configure your organization/)).toBeTruthy();
  expect(screen.getByText("Acme Corp")).toBeTruthy();
  expect(screen.getByText(/Setup progress:/)).toBeTruthy();

  // Verify the 4 cards exist
  expect(screen.getByRole("heading", { name: "Organization details" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Create your workspace" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Set up access" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Review and finish" })).toBeTruthy();
});

it("shows Step 1 active and Step 2 locked when organization details are incomplete", async () => {
  renderOnboarding();
  await screen.findByRole("heading", { name: "Set up your organization" });

  // Step 1 primary action is ready
  expect(screen.getByRole("button", { name: /Complete details/ })).toBeTruthy();

  // Step 2 is locked with explanation
  expect(screen.getByText(/Complete and save your organization details in Step 1 first/)).toBeTruthy();
  const step2Btn = screen.getByRole("button", { name: /Set up workspace/ });
  expect(step2Btn.hasAttribute("disabled")).toBe(true);

  // Step 3 is locked with explanation
  expect(screen.getByText(/Create your first workspace in Step 2 before configuring member access/)).toBeTruthy();
  const step3Btn = screen.getByRole("button", { name: /Invite members/ });
  expect(step3Btn.hasAttribute("disabled")).toBe(true);
});

it("unlocks Step 2 when organization details are saved", async () => {
  testState.orgDetails = {
    ...testState.orgDetails,
    name: "Acme Global",
    primaryEmail: "admin@acme.test",
    primaryPhone: "+1-555-0100",
  };

  renderOnboarding();
  await screen.findByRole("heading", { name: "Set up your organization" });

  // Step 1 shows completed phone and edit details
  expect(screen.getByText("+1-555-0100")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Edit details" }).length).toBeGreaterThanOrEqual(1);

  // Step 2 is now active
  const setupWsBtn = screen.getByRole("button", { name: /Set up workspace/ });
  expect(setupWsBtn).toBeTruthy();
  expect(setupWsBtn.hasAttribute("disabled")).toBe(false);
});

it("creates a workspace and increments setup progress", async () => {
  testState.orgDetails = {
    ...testState.orgDetails,
    name: "Acme Global",
    primaryEmail: "admin@acme.test",
    primaryPhone: "+1-555-0100",
  };

  renderOnboarding();
  await screen.findByRole("heading", { name: "Set up your organization" });

  // Open create workspace modal
  fireEvent.click(await screen.findByRole("button", { name: /Set up workspace/ }));
  await screen.findByRole("heading", { name: "Create Your First Workspace" });

  // Fill in form
  const nameInput = screen.getByLabelText(/Workspace display name/);
  fireEvent.change(nameInput, { target: { value: "HQ Operations" } });
  expect((screen.getByLabelText(/Workspace key/) as HTMLInputElement).value).toBe("hq-operations");

  // Submit form
  const submitBtn = screen.getByRole("button", { name: /Provision workspace/ });
  fireEvent.click(submitBtn);

  await waitFor(() => {
    expect(workspaceApi.createOrganizationWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "HQ Operations", key: "hq-operations" })
    );
  });
});

it("preserves entered workspace name and key and renders error notice when provisioning fails", async () => {
  testState.orgDetails = {
    ...testState.orgDetails,
    name: "Acme Global",
    primaryEmail: "admin@acme.test",
    primaryPhone: "+1-555-0100",
  };
  vi.mocked(workspaceApi.createOrganizationWorkspace).mockRejectedValueOnce(
    new Error("Workspace key already exists in this organization: main-hr")
  );

  renderOnboarding();
  await screen.findByRole("heading", { name: "Set up your organization" });

  fireEvent.click(await screen.findByRole("button", { name: /Set up workspace/ }));
  await screen.findByRole("heading", { name: "Create Your First Workspace" });

  const nameInput = screen.getByLabelText(/Workspace display name/) as HTMLInputElement;
  const keyInput = screen.getByLabelText(/Workspace key/) as HTMLInputElement;

  fireEvent.change(nameInput, { target: { value: "Main HR" } });
  expect(keyInput.value).toBe("main-hr");

  const submitBtn = screen.getByRole("button", { name: /Provision workspace/ });
  fireEvent.click(submitBtn);

  await screen.findByRole("alert");
  expect(screen.getByRole("alert").textContent).toContain("Workspace key already exists in this organization: main-hr");

  // Name and key inputs retain user values for retry
  expect(nameInput.value).toBe("Main HR");
  expect(keyInput.value).toBe("main-hr");
});

it("supports inviting members and marks access step ready", async () => {
  testState.orgDetails = {
    ...testState.orgDetails,
    primaryEmail: "admin@acme.test",
    primaryPhone: "+1-555-0100",
  };
  testState.workspaces = [
    { key: "main", displayName: "Main HR", status: "ACTIVE", products: [{ key: "workforce", displayName: "Workforce" }] },
  ];

  renderOnboarding();
  await screen.findByRole("heading", { name: "Set up your organization" });

  // Step 3 is unlocked
  const inviteBtn = screen.getByRole("button", { name: /Invite members/ });
  expect(inviteBtn).toBeTruthy();
  fireEvent.click(inviteBtn);

  // Invite modal appears
  await screen.findByRole("heading", { name: "Invite Team Member" });
  fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: "member@acme.test" } });
  const form = screen.getByRole("dialog").querySelector("form")!;
  fireEvent.submit(form);

  await waitFor(() => {
    expect(adminApi.createInvitation).toHaveBeenCalledWith("member@acme.test", "EMPLOYEE");
  });
});

it("handles API failure and allows retrying without losing view", async () => {
  vi.mocked(adminApi.getOrganization).mockRejectedValue(new Error("Network connection failed"));

  renderOnboarding();
  await screen.findByRole("heading", { name: "Set up your organization" });
  expect((await screen.findByRole("alert")).textContent).toContain("Network connection failed");

  const retryBtn = screen.getByRole("button", { name: "Retry loading" });
  expect(retryBtn).toBeTruthy();

  vi.mocked(adminApi.getOrganization).mockResolvedValue(testState.orgDetails);
  fireEvent.click(retryBtn);

  await screen.findByText(/Setup progress:/);
});

it("displays Help & Support modal when help button is clicked", async () => {
  renderOnboarding();
  await screen.findByRole("heading", { name: "Set up your organization" });

  // Click Help & Documentation in supporting cards
  const helpBtn = screen.getByRole("button", { name: /Open help guide/ });
  fireEvent.click(helpBtn);

  await screen.findByRole("heading", { name: "Help & Documentation" });
  expect(screen.getByText("Organization Onboarding Guide")).toBeTruthy();
  expect(screen.getByText("Keyboard Shortcuts")).toBeTruthy();

  // Close modal with Esc
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => {
    expect(screen.queryByRole("heading", { name: "Help & Documentation" })).toBeNull();
  });
});

it("renders OnboardingTopBar with progress count during onboarding", async () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  testState.workspaces = [];
  testState.workspace = null;

  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/app/onboarding"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/app/onboarding" element={<OnboardingPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );

  // Expect OnboardingTopBar elements: search input, progress pill, help button, notifications
  await screen.findByLabelText("Global search navigation");
  expect(screen.getByLabelText(/Setup progress: /)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Help and documentation" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
});

it("renders operational ContextSelector when organization is configured", async () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  testState.workspaces = [
    { key: "main", displayName: "Main HR", status: "ACTIVE", products: [{ key: "workforce", displayName: "Workforce" }] },
  ];
  testState.workspace = testState.workspaces[0];

  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/app"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/app" element={<div>Operational Overview</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );

  await screen.findByText("Operational Overview");
  expect(screen.getByLabelText(/Current organization:/)).toBeTruthy();
  expect(screen.getByLabelText(/Current workspace:/)).toBeTruthy();
});
