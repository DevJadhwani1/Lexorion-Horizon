import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./AppShell";
import { AdminScreen } from "../pages/admin/AdminScreen";
import { ThemeProvider } from "../theme/ThemeProvider";

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "admin-1", firstName: "Dev", lastName: "Admin", email: "admin@example.com" },
    organization: { organizationId: "org-1", slug: "test-org", organizationName: "Test Org", membershipRole: "ADMIN" },
    organizations: [{ organizationId: "org-1", slug: "test-org", organizationName: "Test Org" }],
    selectOrganization: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("../workspace/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    workspace: {
      key: "main-ws",
      displayName: "Main Workspace",
      products: [
        { key: "workforce", displayName: "Workforce" },
        { key: "payroll", displayName: "Payroll" },
      ],
    },
    workspaces: [
      {
        key: "main-ws",
        displayName: "Main Workspace",
        status: "ACTIVE",
        products: [
          { key: "workforce", displayName: "Workforce" },
          { key: "payroll", displayName: "Payroll" },
        ],
      },
    ],
    loading: false,
    selectWorkspace: vi.fn(),
  }),
}));

vi.mock("../context/ApplicationContext", () => ({
  useApplicationContext: () => ({ mode: "client", hasPlatformAccess: false }),
}));

function AdminTestRoute({ section, title }: { section: string; title: string }) {
  return (
    <AdminScreen sectionKey={section} title={title}>
      <div data-testid={`content-${section}`}>{title} Page Content</div>
    </AdminScreen>
  );
}

function renderAdminApp(initialRoute = "/organization") {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/organization" element={<AdminTestRoute section="organization" title="Organization" />} />
            <Route path="/organization/workspaces" element={<AdminTestRoute section="workspaces" title="Workspaces" />} />
            <Route path="/people" element={<AdminTestRoute section="members" title="Members" />} />
            <Route path="/organization/invitations" element={<AdminTestRoute section="invitations" title="Invitations" />} />
            <Route path="/organization/settings" element={<AdminTestRoute section="settings" title="Settings" />} />
            <Route path="/organization/settings/product-access" element={<AdminTestRoute section="product-access" title="Settings" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("Organization Administration Sidebar Navigation", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    try {
      sessionStorage.setItem("lexorion.sidebar-collapsed", "false");
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("contains the five administration destinations under the Organization sidebar group", () => {
    renderAdminApp("/organization");

    const sidebar = screen.getByRole("complementary", { name: "Application navigation" });
    expect(within(sidebar).getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe("/overview");
    const orgGroup = within(sidebar).getByRole("region", { name: "Organization" });

    const expectedLinks = [
      { label: "Organization", href: "/organization" },
      { label: "Workspaces", href: "/organization/workspaces" },
      { label: "Members", href: "/people" },
      { label: "Invitations", href: "/organization/invitations" },
      { label: "Settings", href: "/organization/settings" },
    ];

    const links = within(orgGroup).getAllByRole("link");
    expect(links).toHaveLength(5);
    expect(within(sidebar).queryByRole("link", { name: "Entitlements" })).toBeNull();

    expectedLinks.forEach((expected, index) => {
      expect(links[index].textContent).toContain(expected.label);
      expect(links[index].getAttribute("href")).toBe(expected.href);
    });
  });

  it("keeps Workspaces under Organization alongside the WORKFORCE and PAYROLL sidebar groups", () => {
    renderAdminApp("/organization");

    const sidebar = screen.getByRole("complementary", { name: "Application navigation" });

    // Verify separate groups exist
    expect(within(sidebar).getByRole("region", { name: "Organization" })).toBeDefined();
    expect(within(sidebar).queryByRole("region", { name: "Workspaces" })).toBeNull();
    expect(within(sidebar).getByRole("region", { name: "Workforce" })).toBeDefined();
    expect(within(sidebar).getByRole("region", { name: "Payroll" })).toBeDefined();
  });

  it("removes horizontal nav.admin-tabs row from all administration screens", () => {
    const { container, unmount } = renderAdminApp("/organization");
    expect(container.querySelector("nav.admin-tabs")).toBeNull();
    unmount();

    const sections = ["/organization/workspaces", "/people", "/organization/invitations", "/organization/settings", "/organization/settings/product-access"];
    for (const section of sections) {
      const view = renderAdminApp(section);
      expect(view.container.querySelector("nav.admin-tabs")).toBeNull();
      view.unmount();
    }
  });

  it("navigates to each page on click and highlights the active route while keeping sidebar expanded", () => {
    const { container } = renderAdminApp("/organization");

    const sidebar = screen.getByRole("complementary", { name: "Application navigation" });
    const orgGroup = within(sidebar).getByRole("region", { name: "Organization" });

    // Verify initial active state on /admin/organization
    const orgLink = within(orgGroup).getByRole("link", { name: "Organization" });
    expect(orgLink.classList.contains("active")).toBe(true);
    expect(screen.getByTestId("content-organization")).toBeDefined();

    // Verify sidebar is expanded (not collapsed)
    const shell = container.querySelector(".shell");
    expect(shell?.classList.contains("sidebar-collapsed")).toBe(false);

    const testRoutes = [
      { name: "Workspaces", testId: "content-workspaces" },
      { name: "Members", testId: "content-members" },
      { name: "Invitations", testId: "content-invitations" },
      { name: "Settings", testId: "content-settings" },
      { name: "Organization", testId: "content-organization" },
    ];

    for (const dest of testRoutes) {
      const link = within(orgGroup).getByRole("link", { name: dest.name });
      fireEvent.click(link);

      // Verify content rendered
      expect(screen.getByTestId(dest.testId)).toBeDefined();

      // Verify active class updated
      expect(link.classList.contains("active")).toBe(true);

      // Verify sidebar remains visible and expanded
      expect(screen.getByRole("complementary", { name: "Application navigation" })).toBeDefined();
      expect(shell?.classList.contains("sidebar-collapsed")).toBe(false);

      // Verify no admin tabs
      expect(container.querySelector("nav.admin-tabs")).toBeNull();
    }
  });

  it("keeps Settings active on the Product access section", () => {
    renderAdminApp("/organization/settings/product-access");

    const sidebar = screen.getByRole("complementary", { name: "Application navigation" });
    const orgGroup = within(sidebar).getByRole("region", { name: "Organization" });

    expect(screen.getByTestId("content-product-access")).toBeDefined();
    expect(within(orgGroup).getByRole("link", { name: "Settings" }).classList.contains("active")).toBe(true);
    expect(within(orgGroup).getByRole("link", { name: "Organization" }).classList.contains("active")).toBe(false);
  });
});
