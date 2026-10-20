import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./AppShell";
import { ThemeProvider } from "../theme/ThemeProvider";

const workspaceState = vi.hoisted(() => ({ workspace: { key: "main", products: [] } as { key: string; products: never[] } | null }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ user: { id: "user" }, organization: { organizationId: "org", slug: "org", membershipRole: "ADMIN" }, organizations: [] }) }));
vi.mock("../workspace/WorkspaceProvider", () => ({ useWorkspace: () => ({ workspace: workspaceState.workspace, workspaces: [], loading: false }) }));
vi.mock("../context/ApplicationContext", () => ({ useApplicationContext: () => ({ mode: "client", hasPlatformAccess: false }) }));
vi.mock("./Sidebar", () => ({ Sidebar: () => null }));
afterEach(() => { workspaceState.workspace = { key: "main", products: [] }; cleanup(); vi.unstubAllGlobals(); });

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
  const tree = () => <ThemeProvider><MemoryRouter initialEntries={["/app/admin/workspaces"]}><Routes><Route element={<AppShell />}><Route path="/app/admin/workspaces" element={<Screen />} /></Route></Routes></MemoryRouter></ThemeProvider>;
  const view = render(tree());
  fireEvent.change(screen.getByLabelText("Unsaved edit"), { target: { value: "workforce" } });
  workspaceState.workspace = null; view.rerender(tree());
  expect((screen.getByLabelText("Unsaved edit") as HTMLInputElement).value).toBe("workforce");
  workspaceState.workspace = { key: "main", products: [] }; view.rerender(tree());
  expect((screen.getByLabelText("Unsaved edit") as HTMLInputElement).value).toBe("workforce");
});
