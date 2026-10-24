import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, cleanup } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { clientRoutes, getTopLevelCompatibilityRoutes } from "./Router";
import { appPath } from "./hostRouting";

vi.mock("../theme/ThemeProvider", () => ({ useTheme: () => ({ t: {} }) }));

const authState = vi.hoisted(() => ({
  user: { id: "user-1", firstName: "Dev", lastName: "Admin", email: "admin@example.com" },
  organization: { organizationId: "org-1", slug: "lexorion", organizationName: "Lexorion Corp", membershipRole: "ADMIN" } as any,
  loading: false,
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    user: authState.user,
    organization: authState.organization,
    organizations: authState.organization ? [authState.organization] : [],
    loading: authState.loading,
    selectOrganization: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("../workspace/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    workspace: { key: "ws-1", displayName: "Main", products: [{ key: "workforce", displayName: "Workforce" }] },
    workspaces: [{ key: "ws-1", displayName: "Main", status: "ACTIVE", products: [{ key: "workforce", displayName: "Workforce" }] }],
    loading: false,
    error: null,
    selectWorkspace: vi.fn(),
    reload: vi.fn(),
  }),
}));

vi.mock("../context/ApplicationContext", () => ({
  useApplicationContext: () => ({ mode: "client", hasPlatformAccess: false }),
}));

// Mock the heavy page components to verify route rendering directly
vi.mock("../pages/admin/AdminPage", () => ({
  AdminPage: ({ sectionKey }: { sectionKey?: string }) => (
    <div data-testid={`admin-page-${sectionKey || "default"}`}>AdminPage: {sectionKey}</div>
  ),
}));

vi.mock("../pages/admin/AdminWorkspaces", () => ({
  AdminWorkspaces: () => <div data-testid="admin-workspaces-page">AdminWorkspaces</div>,
}));

vi.mock("../pages/HomePage", () => ({
  HomePage: () => <div data-testid="home-page">HomePage</div>,
}));

vi.mock("../pages/onboarding/OnboardingPage", () => ({
  OnboardingPage: () => <div data-testid="onboarding-page">OnboardingPage</div>,
}));

function AppShellLayout() {
  return (
    <div data-testid="app-shell">
      <Outlet />
    </div>
  );
}

describe("appPath canonical and compatibility mappings", () => {
  it("maps canonical organization routes correctly on local host", () => {
    expect(appPath("/organization")).toBe("/organization");
    expect(appPath("/organization/workspaces")).toBe("/organization/workspaces");
    expect(appPath("/people")).toBe("/people");
    expect(appPath("/organization/invitations")).toBe("/organization/invitations");
    expect(appPath("/organization/settings")).toBe("/organization/settings");
    expect(appPath("/organization/settings/product-access")).toBe("/organization/settings/product-access");
    expect(appPath("/settings/organization")).toBe("/organization/settings");
    expect(appPath("/settings/organization/product-access")).toBe("/organization/settings/product-access");
  });

  it("maps legacy admin routes to canonical local paths", () => {
    expect(appPath("/admin/organization")).toBe("/organization");
    expect(appPath("/admin/workspaces")).toBe("/organization/workspaces");
    expect(appPath("/admin/members")).toBe("/people");
    expect(appPath("/admin/invitations")).toBe("/organization/invitations");
    expect(appPath("/admin/settings")).toBe("/organization/settings");
    expect(appPath("/admin/entitlements")).toBe("/organization/settings/product-access");
  });

  it("maps legacy top-level customer aliases to canonical local paths", () => {
    expect(appPath("/workspaces")).toBe("/organization/workspaces");
    expect(appPath("/members")).toBe("/people");
    expect(appPath("/invitations")).toBe("/organization/invitations");
    expect(appPath("/settings")).toBe("/organization/settings");
    expect(appPath("/entitlements")).toBe("/organization/settings/product-access");

    expect(appPath("/app")).toBe("/overview");
    expect(appPath("/app/organization/members?role=admin")).toBe("/people?role=admin");
    expect(appPath("/app/payroll/pay-runs?run=RUN-1")).toBe("/payroll/runs?run=RUN-1");
    expect(appPath("/app/payroll/employees")).toBe("/payroll/employees");
    expect(appPath("/organization/departments")).toBe("/workforce/departments");
  });
});

describe("Client and local route architecture", () => {
  beforeEach(() => {
    authState.user = { id: "user-1", firstName: "Dev", lastName: "Admin", email: "admin@example.com" };
    authState.organization = { organizationId: "org-1", slug: "lexorion", organizationName: "Lexorion Corp", membershipRole: "ADMIN" };
    authState.loading = false;
  });

  afterEach(() => {
    cleanup();
  });

  function createTestRouter(initialPath: string, local = true) {
    const routes = [
      ...getTopLevelCompatibilityRoutes(local ? "local" : "client"),
      {
        path: "/",
        element: <AppShellLayout />,
        children: clientRoutes(),
      },
    ];
    return createMemoryRouter(routes, { initialEntries: [initialPath] });
  }

  it("renders all canonical routes under local development (/organization/*)", () => {
    const canonicalPaths = [
      { path: "/organization", testId: "admin-page-organization" },
      { path: "/organization/workspaces", testId: "admin-workspaces-page" },
      { path: "/people", testId: "admin-page-members" },
      { path: "/organization/invitations", testId: "admin-page-invitations" },
      { path: "/organization/settings", testId: "admin-page-settings" },
      { path: "/organization/settings/product-access", testId: "admin-page-product-access" },
    ];

    for (const item of canonicalPaths) {
      const router = createTestRouter(item.path, true);
      const { unmount } = render(<RouterProvider router={router} />);
      expect(screen.getByTestId(item.testId)).toBeTruthy();
      unmount();
    }
  });

  it("renders all canonical routes on customer host (/organization/*)", () => {
    const canonicalPaths = [
      { path: "/organization", testId: "admin-page-organization" },
      { path: "/organization/workspaces", testId: "admin-workspaces-page" },
      { path: "/people", testId: "admin-page-members" },
      { path: "/organization/invitations", testId: "admin-page-invitations" },
      { path: "/organization/settings", testId: "admin-page-settings" },
      { path: "/organization/settings/product-access", testId: "admin-page-product-access" },
    ];


    for (const item of canonicalPaths) {
      const router = createTestRouter(item.path, false);
      const { unmount } = render(<RouterProvider router={router} />);
      expect(screen.getByTestId(item.testId)).toBeTruthy();
      unmount();
    }
  });

  it("redirects legacy /app URLs to canonical routes and keeps the query string", () => {
    const directEntries = [
      { from: "/app/organization", testId: "admin-page-organization" },
      { from: "/app/organization/workspaces", testId: "admin-workspaces-page" },
      { from: "/app/organization/members?role=admin", testId: "admin-page-members", pathname: "/people", search: "?role=admin" },
      { from: "/app/organization/invitations", testId: "admin-page-invitations" },
      { from: "/app/organization/settings", testId: "admin-page-settings" },
      { from: "/app?tab=home", pathname: "/overview", search: "?tab=home" },
    ];

    for (const item of directEntries) {
      const router = createTestRouter(item.from, true);
      const { unmount } = render(<RouterProvider router={router} />);
      if (item.testId) expect(screen.getByTestId(item.testId)).toBeTruthy();
      if (item.pathname) expect(router.state.location.pathname).toBe(item.pathname);
      if (item.search) expect(router.state.location.search).toBe(item.search);
      unmount();
    }
  });

  it("redirects legacy /admin/* routes to /organization/* on local", () => {
    const legacyRedirects = [
      { from: "/admin/organization", testId: "admin-page-organization" },
      { from: "/admin/workspaces", testId: "admin-workspaces-page" },
      { from: "/admin/members", testId: "admin-page-members" },
      { from: "/admin/invitations", testId: "admin-page-invitations" },
      { from: "/admin/settings", testId: "admin-page-settings" },
      { from: "/admin/entitlements", testId: "admin-page-product-access" },
      { from: "/admin", testId: "admin-page-organization" },
    ];

    for (const item of legacyRedirects) {
      const router = createTestRouter(item.from, true);
      const { unmount } = render(<RouterProvider router={router} />);
      expect(screen.getByTestId(item.testId)).toBeTruthy();
      unmount();
    }
  });

  it("redirects legacy top-level customer aliases to /organization/* on local", () => {
    const aliasRedirects = [
      { from: "/workspaces", testId: "admin-workspaces-page" },
      { from: "/members", testId: "admin-page-members" },
      { from: "/invitations", testId: "admin-page-invitations" },
      { from: "/settings", testId: "admin-page-settings" },
      { from: "/entitlements", testId: "admin-page-product-access" },
    ];

    for (const item of aliasRedirects) {
      const router = createTestRouter(item.from, true);
      const { unmount } = render(<RouterProvider router={router} />);
      expect(screen.getByTestId(item.testId)).toBeTruthy();
      unmount();
    }
  });

  it("redirects legacy routes to canonical routes on customer host", () => {
    const legacyCustomerRedirects = [
      { from: "/admin/organization", testId: "admin-page-organization" },
      { from: "/admin/workspaces", testId: "admin-workspaces-page" },
      { from: "/admin", testId: "admin-page-organization" },
      { from: "/workspaces", testId: "admin-workspaces-page" },
      { from: "/members", testId: "admin-page-members" },
      { from: "/invitations", testId: "admin-page-invitations" },
      { from: "/settings", testId: "admin-page-settings" },
      { from: "/entitlements", testId: "admin-page-product-access" },
    ];

    for (const item of legacyCustomerRedirects) {
      const router = createTestRouter(item.from, false);
      const { unmount } = render(<RouterProvider router={router} />);
      expect(screen.getByTestId(item.testId)).toBeTruthy();
      unmount();
    }
  });

  it("redirects every legacy Entitlements URL to Settings > Product access", () => {
    const cases: Array<{ from: string; local: boolean; to: string }> = [
      { from: "/app/organization/entitlements", local: true, to: "/organization/settings/product-access" },
      { from: "/organization/entitlements", local: true, to: "/organization/settings/product-access" },
      { from: "/app/admin/entitlements", local: true, to: "/organization/settings/product-access" },
      { from: "/app/entitlements", local: true, to: "/organization/settings/product-access" },
      { from: "/entitlements", local: true, to: "/organization/settings/product-access" },
      { from: "/organization/entitlements", local: false, to: "/organization/settings/product-access" },
      { from: "/admin/entitlements", local: false, to: "/organization/settings/product-access" },
      { from: "/entitlements", local: false, to: "/organization/settings/product-access" },
      { from: "/app/organization/entitlements", local: false, to: "/organization/settings/product-access" },
      { from: "/app/entitlements", local: false, to: "/organization/settings/product-access" },
    ];

    for (const item of cases) {
      const router = createTestRouter(item.from, item.local);
      const { unmount } = render(<RouterProvider router={router} />);
      expect(screen.getByTestId("admin-page-product-access")).toBeTruthy();
      expect(router.state.location.pathname).toBe(item.to);
      unmount();
    }
  });

  it("supports back and forward between Settings sections", async () => {
    const router = createTestRouter("/organization/settings", true);
    render(<RouterProvider router={router} />);
    expect(screen.getByTestId("admin-page-settings")).toBeTruthy();

    await act(() => router.navigate("/organization/settings/product-access"));
    expect(router.state.location.pathname).toBe("/organization/settings/product-access");
    expect(screen.getByTestId("admin-page-product-access")).toBeTruthy();

    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe("/organization/settings");
    expect(screen.getByTestId("admin-page-settings")).toBeTruthy();

    await act(() => router.navigate(1));
    expect(router.state.location.pathname).toBe("/organization/settings/product-access");
    expect(screen.getByTestId("admin-page-product-access")).toBeTruthy();
  });


  it("enforces ADMIN role guard on canonical organization routes", () => {
    authState.organization.membershipRole = "EMPLOYEE";

    const router = createTestRouter("/organization", true);
    render(<RouterProvider router={router} />);

    expect(screen.queryByTestId("admin-page-organization")).toBeNull();
    expect(screen.getByText("Your organization role does not provide administration access.")).toBeTruthy();
  });

  it("enforces organization context requirement on canonical organization routes", () => {
    authState.organization = null;

    const router = createTestRouter("/organization", true);
    render(<RouterProvider router={router} />);

    expect(screen.queryByTestId("admin-page-organization")).toBeNull();
    expect(screen.getByText("Choose an organization before opening this area.")).toBeTruthy();
  });
});
