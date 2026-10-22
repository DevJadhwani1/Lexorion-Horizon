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
    expect(appPath("/organization")).toBe("/app/organization");
    expect(appPath("/organization/workspaces")).toBe("/app/organization/workspaces");
    expect(appPath("/organization/members")).toBe("/app/organization/members");
    expect(appPath("/organization/invitations")).toBe("/app/organization/invitations");
    expect(appPath("/organization/settings")).toBe("/app/organization/settings");
    expect(appPath("/organization/settings/product-access")).toBe("/app/organization/settings/product-access");
    expect(appPath("/organization/entitlements")).toBe("/app/organization/settings/product-access");
  });

  it("maps legacy admin routes to canonical local paths", () => {
    expect(appPath("/app/admin/organization")).toBe("/app/organization");
    expect(appPath("/app/admin/workspaces")).toBe("/app/organization/workspaces");
    expect(appPath("/app/admin/members")).toBe("/app/organization/members");
    expect(appPath("/app/admin/invitations")).toBe("/app/organization/invitations");
    expect(appPath("/app/admin/settings")).toBe("/app/organization/settings");
    expect(appPath("/app/admin/entitlements")).toBe("/app/organization/settings/product-access");
  });

  it("maps legacy top-level customer aliases to canonical local paths", () => {
    expect(appPath("/workspaces")).toBe("/app/organization/workspaces");
    expect(appPath("/members")).toBe("/app/organization/members");
    expect(appPath("/invitations")).toBe("/app/organization/invitations");
    expect(appPath("/settings")).toBe("/app/organization/settings");
    expect(appPath("/entitlements")).toBe("/app/organization/settings/product-access");
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
        path: local ? "/app" : "/",
        element: <AppShellLayout />,
        children: clientRoutes(local),
      },
    ];
    return createMemoryRouter(routes, { initialEntries: [initialPath] });
  }

  it("renders all canonical routes under local development (/app/organization/*)", () => {
    const canonicalPaths = [
      { path: "/app/organization", testId: "admin-page-organization" },
      { path: "/app/organization/workspaces", testId: "admin-workspaces-page" },
      { path: "/app/organization/members", testId: "admin-page-members" },
      { path: "/app/organization/invitations", testId: "admin-page-invitations" },
      { path: "/app/organization/settings", testId: "admin-page-settings" },
      { path: "/app/organization/settings/product-access", testId: "admin-page-product-access" },
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
      { path: "/organization/members", testId: "admin-page-members" },
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

  it("redirects direct URL entry of /organization/* at top-level to /app/organization/* on local", () => {
    const directEntries = [
      { from: "/organization", testId: "admin-page-organization" },
      { from: "/organization/workspaces", testId: "admin-workspaces-page" },
      { from: "/organization/members", testId: "admin-page-members" },
      { from: "/organization/invitations", testId: "admin-page-invitations" },
      { from: "/organization/settings", testId: "admin-page-settings" },
      { from: "/organization/entitlements", testId: "admin-page-product-access" },
    ];

    for (const item of directEntries) {
      const router = createTestRouter(item.from, true);
      const { unmount } = render(<RouterProvider router={router} />);
      expect(screen.getByTestId(item.testId)).toBeTruthy();
      unmount();
    }
  });

  it("redirects legacy /app/admin/* routes to /app/organization/* on local", () => {
    const legacyRedirects = [
      { from: "/app/admin/organization", testId: "admin-page-organization" },
      { from: "/app/admin/workspaces", testId: "admin-workspaces-page" },
      { from: "/app/admin/members", testId: "admin-page-members" },
      { from: "/app/admin/invitations", testId: "admin-page-invitations" },
      { from: "/app/admin/settings", testId: "admin-page-settings" },
      { from: "/app/admin/entitlements", testId: "admin-page-product-access" },
      { from: "/app/admin", testId: "admin-page-organization" },
    ];

    for (const item of legacyRedirects) {
      const router = createTestRouter(item.from, true);
      const { unmount } = render(<RouterProvider router={router} />);
      expect(screen.getByTestId(item.testId)).toBeTruthy();
      unmount();
    }
  });

  it("redirects legacy top-level customer aliases to /app/organization/* on local", () => {
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
      { from: "/app/organization/entitlements", local: true, to: "/app/organization/settings/product-access" },
      { from: "/organization/entitlements", local: true, to: "/app/organization/settings/product-access" },
      { from: "/app/admin/entitlements", local: true, to: "/app/organization/settings/product-access" },
      { from: "/app/entitlements", local: true, to: "/app/organization/settings/product-access" },
      { from: "/entitlements", local: true, to: "/app/organization/settings/product-access" },
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
    const router = createTestRouter("/app/organization/settings", true);
    render(<RouterProvider router={router} />);
    expect(screen.getByTestId("admin-page-settings")).toBeTruthy();

    await act(() => router.navigate("/app/organization/entitlements"));
    expect(router.state.location.pathname).toBe("/app/organization/settings/product-access");
    expect(screen.getByTestId("admin-page-product-access")).toBeTruthy();

    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe("/app/organization/settings");
    expect(screen.getByTestId("admin-page-settings")).toBeTruthy();

    await act(() => router.navigate(1));
    expect(router.state.location.pathname).toBe("/app/organization/settings/product-access");
    expect(screen.getByTestId("admin-page-product-access")).toBeTruthy();
  });

  it("enforces ADMIN role guard on canonical organization routes", () => {
    authState.organization.membershipRole = "EMPLOYEE";

    const router = createTestRouter("/app/organization", true);
    render(<RouterProvider router={router} />);

    expect(screen.queryByTestId("admin-page-organization")).toBeNull();
    expect(screen.getByText("Your organization role does not provide administration access.")).toBeTruthy();
  });

  it("enforces organization context requirement on canonical organization routes", () => {
    authState.organization = null;

    const router = createTestRouter("/app/organization", true);
    render(<RouterProvider router={router} />);

    expect(screen.queryByTestId("admin-page-organization")).toBeNull();
    expect(screen.getByText("Choose an organization before opening this area.")).toBeTruthy();
  });
});
