import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./AppShell";
import { ThemeProvider } from "../theme/ThemeProvider";

const workspaceState = vi.hoisted(() => ({
  workspace: { key: "main", displayName: "Main", products: [] } as any,
  workspaces: [{ key: "main", displayName: "Main", status: "ACTIVE", products: [] }] as any[],
}));
vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "user", firstName: "Admin" },
    organization: { organizationId: "org", slug: "org", organizationName: "Acme Org", membershipRole: "ADMIN" },
    organizations: [{ organizationId: "org", slug: "org", organizationName: "Acme Org" }],
  }),
}));
vi.mock("../workspace/WorkspaceProvider", () => ({
  useWorkspace: () => ({
    workspace: workspaceState.workspace,
    workspaces: workspaceState.workspaces,
    loading: false,
    selectWorkspace: vi.fn(),
  }),
}));
vi.mock("../context/ApplicationContext", () => ({ useApplicationContext: () => ({ mode: "client", hasPlatformAccess: false }) }));
vi.mock("./Sidebar", () => ({ Sidebar: () => null }));
afterEach(() => {
  workspaceState.workspace = { key: "main", displayName: "Main", products: [] };
  workspaceState.workspaces = [{ key: "main", displayName: "Main", status: "ACTIVE", products: [] }];
  cleanup();
  vi.unstubAllGlobals();
});

it("resets a screen's loaded state when navigating to another domain screen", () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  function Screen({ section }: { section: string }) {
    const [loaded] = useState(section);
    return <><output>{loaded}</output><Link to="/employees">Employees</Link></>;
  }
  render(<ThemeProvider><MemoryRouter initialEntries={["/departments"]}><Routes>
    <Route element={<AppShell />}><Route path="/departments" element={<Screen section="departments" />} /><Route path="/employees" element={<Screen section="employees" />} /></Route>
  </Routes></MemoryRouter></ThemeProvider>);
  expect(screen.getByRole("status").textContent).toBe("departments");
  fireEvent.click(screen.getByRole("link", { name: "Employees" }));
  expect(screen.getByRole("status").textContent).toBe("employees");
});

it("preserves organization administration forms during a workspace refresh", () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  function Screen() { const [value, setValue] = useState(""); return <input aria-label="Unsaved edit" value={value} onChange={e => setValue(e.target.value)} />; }
  const tree = (path = "/app/organization/workspaces") => <ThemeProvider><MemoryRouter initialEntries={[path]}><Routes><Route element={<AppShell />}><Route path={path} element={<Screen />} /></Route></Routes></MemoryRouter></ThemeProvider>;
  const view = render(tree());
  fireEvent.change(screen.getByLabelText("Unsaved edit"), { target: { value: "workforce" } });
  workspaceState.workspace = null; view.rerender(tree());
  expect((screen.getByLabelText("Unsaved edit") as HTMLInputElement).value).toBe("workforce");
  workspaceState.workspace = { key: "main", displayName: "Main", products: [] }; view.rerender(tree());
  expect((screen.getByLabelText("Unsaved edit") as HTMLInputElement).value).toBe("workforce");
});

it("renders OnboardingTopBar when organization has 0 workspaces (requires onboarding)", async () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  workspaceState.workspace = null;
  workspaceState.workspaces = [];
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/app"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/app" element={<div>Onboarding Area</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
  await screen.findByLabelText("Global search navigation");
  expect(screen.getByLabelText(/Setup progress:/)).toBeTruthy();
});

it("renders operational ContextSelector when workspaces exist (setup is complete)", async () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  workspaceState.workspace = { key: "main", displayName: "Main", products: [] };
  workspaceState.workspaces = [{ key: "main", displayName: "Main", status: "ACTIVE", products: [] }];
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/app"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/app" element={<div>Dashboard Area</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
  await screen.findByText("Dashboard Area");
  expect(screen.getByLabelText(/Current organization:/)).toBeTruthy();
  expect(screen.getByLabelText(/Current workspace:/)).toBeTruthy();
});
