import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceProvider";
import { getAccessibleWorkspaces, type OrganizationWorkspace } from "../features/admin/workspaceApi";
import { session } from "../api/session";

const state = vi.hoisted(() => ({ organization: { organizationId: "a", slug: "alpha" }, mode: "client", rememberWorkspace: vi.fn() }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => state }));
vi.mock("../context/ApplicationContext", () => ({ useApplicationContext: () => state }));
vi.mock("../core/coreApi", () => ({ getProductAccess: vi.fn(async () => [{ productKey: "horizon" }]) }));
vi.mock("../features/admin/workspaceApi", () => ({ getAccessibleWorkspaces: vi.fn() }));

function View() {
  const value = useWorkspace();
  return <><output>{value.workspaces.map(item => item.key).join(",") || "empty"}</output>
    <span>{value.workspace?.key ?? "no selection"}</span>
    <button onClick={() => value.selectWorkspace("foreign")}>Select foreign</button>
    <button onClick={() => value.selectWorkspace("allowed")}>Select allowed</button></>;
}
function workspace(key: string): OrganizationWorkspace {
  return { key, displayName: key, status: "ACTIVE", productKey: "workforce", productName: "Workforce", products: [{ key: "workforce", displayName: "Workforce" }] };
}
beforeEach(() => { sessionStorage.clear(); state.organization = { organizationId: "a", slug: "alpha" }; vi.resetAllMocks(); });
afterEach(cleanup);

it("rejects a delayed workspace response from the previous organization", async () => {
  let finishOld!: (value: OrganizationWorkspace[]) => void;
  vi.mocked(getAccessibleWorkspaces).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockResolvedValueOnce([workspace("new")]);
  const view = render(<WorkspaceProvider><View /></WorkspaceProvider>);
  await waitFor(() => expect(getAccessibleWorkspaces).toHaveBeenCalledTimes(1));
  state.organization = { organizationId: "b", slug: "beta" };
  view.rerender(<WorkspaceProvider><View /></WorkspaceProvider>);
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("new"));
  await act(async () => finishOld([workspace("old")]));
  expect(screen.queryByText("old")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("new");
});

it("clears a stale stored workspace and refuses an inaccessible selection", async () => {
  session.setWorkspace("foreign");
  vi.mocked(getAccessibleWorkspaces).mockResolvedValue([workspace("allowed"), workspace("other")]);
  render(<WorkspaceProvider><View /></WorkspaceProvider>);
  await screen.findByText("allowed,other");
  expect(session.workspace()).toBeNull();
  fireEvent.click(screen.getByText("Select foreign"));
  expect(session.workspace()).toBeNull();
  expect(screen.getByText("no selection")).toBeTruthy();
});

it("selects the only accessible workspace and replaces a stale stored key", async () => {
  session.setWorkspace("foreign");
  vi.mocked(getAccessibleWorkspaces).mockResolvedValue([workspace("only")]);
  render(<WorkspaceProvider><View /></WorkspaceProvider>);
  await waitFor(() => expect(screen.getByText("only", { selector: "span" })).toBeTruthy());
  expect(session.workspace()).toBe("only");
  fireEvent.click(screen.getByText("Select foreign"));
  expect(session.workspace()).toBeNull();
});

it("remembers only verified workspace selections for the current organization", async () => {
  // Two workspaces, so nothing is auto-selected and every selection is the user's.
  vi.mocked(getAccessibleWorkspaces).mockResolvedValue([workspace("allowed"), workspace("other")]);
  render(<WorkspaceProvider><View /></WorkspaceProvider>);
  await screen.findByText("allowed,other");
  fireEvent.click(screen.getByText("Select foreign"));
  expect(state.rememberWorkspace).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Select allowed"));
  expect(session.workspace()).toBe("allowed");
  expect(state.rememberWorkspace).toHaveBeenCalledWith("alpha", "allowed");
});

// Regression: workspace creation used a context captured before reload(), so selection ran against the old list.
type WorkspaceValue = ReturnType<typeof useWorkspace>;
function CaptureFirstRender({ capture }: { capture: { value?: WorkspaceValue } }) {
  const value = useWorkspace();
  capture.value ??= value;
  return <><output>{value.workspaces.map(item => item.key).join(",") || "empty"}</output><span>{value.workspace?.key ?? "no selection"}</span></>;
}

it("selects a newly created workspace from the refreshed list even when the caller holds a stale context", async () => {
  vi.mocked(getAccessibleWorkspaces).mockResolvedValueOnce([workspace("main")]).mockResolvedValue([workspace("main"), workspace("operations")]);
  const capture: { value?: WorkspaceValue } = {};
  render(<WorkspaceProvider><CaptureFirstRender capture={capture} /></WorkspaceProvider>);
  await screen.findByText("main", { selector: "output" });
  let refreshed: OrganizationWorkspace[] | null = null;
  await act(async () => { refreshed = await capture.value!.reload({ select: "operations" }); });
  expect(refreshed!.map(item => item.key)).toEqual(["main", "operations"]);
  expect(session.workspace()).toBe("operations");
  expect(screen.getByText("operations", { selector: "span" })).toBeTruthy();
  expect(state.rememberWorkspace).toHaveBeenCalledWith("alpha", "operations");
});

it("accepts the legacy reload-then-select sequence from a stale context", async () => {
  vi.mocked(getAccessibleWorkspaces).mockResolvedValueOnce([workspace("main")]).mockResolvedValue([workspace("main"), workspace("operations")]);
  const capture: { value?: WorkspaceValue } = {};
  render(<WorkspaceProvider><CaptureFirstRender capture={capture} /></WorkspaceProvider>);
  await screen.findByText("main", { selector: "output" });
  await act(async () => { await capture.value!.reload(); capture.value!.selectWorkspace("operations"); });
  expect(session.workspace()).toBe("operations");
  expect(screen.getByText("operations", { selector: "span" })).toBeTruthy();
});

it("does not store a requested workspace that the refreshed list does not contain", async () => {
  session.setWorkspace("main");
  vi.mocked(getAccessibleWorkspaces).mockResolvedValue([workspace("main")]);
  const capture: { value?: WorkspaceValue } = {};
  render(<WorkspaceProvider><CaptureFirstRender capture={capture} /></WorkspaceProvider>);
  await screen.findByText("main", { selector: "span" });
  await act(async () => { await capture.value!.reload({ select: "missing" }); });
  expect(session.workspace()).toBe("main");
  expect(screen.getByText("main", { selector: "span" })).toBeTruthy();
  expect(state.rememberWorkspace).not.toHaveBeenCalled();
});

it("ignores a creation reload that finishes after the organization changed", async () => {
  let finishCreationReload!: (value: OrganizationWorkspace[]) => void;
  vi.mocked(getAccessibleWorkspaces).mockResolvedValueOnce([workspace("main")])
    .mockImplementationOnce(() => new Promise(resolve => { finishCreationReload = resolve; }))
    .mockResolvedValue([workspace("beta-main")]);
  const capture: { value?: WorkspaceValue } = {};
  const view = render(<WorkspaceProvider><CaptureFirstRender capture={capture} /></WorkspaceProvider>);
  await screen.findByText("main", { selector: "output" });
  let pending!: Promise<OrganizationWorkspace[] | null>;
  act(() => { pending = capture.value!.reload({ select: "operations" }); });
  await waitFor(() => expect(getAccessibleWorkspaces).toHaveBeenCalledTimes(2));
  state.organization = { organizationId: "b", slug: "beta" };
  view.rerender(<WorkspaceProvider><CaptureFirstRender capture={capture} /></WorkspaceProvider>);
  await screen.findByText("beta-main", { selector: "output" });
  let result: OrganizationWorkspace[] | null = [];
  await act(async () => { finishCreationReload([workspace("main"), workspace("operations")]); result = await pending; });
  expect(result).toBeNull();
  expect(session.workspace()).not.toBe("operations");
  // Beta's only workspace is auto-selected; the late Alpha reload must not select or remember anything.
  expect(screen.getByText("beta-main", { selector: "span" })).toBeTruthy();
  expect(state.rememberWorkspace).not.toHaveBeenCalledWith(expect.anything(), "operations");
});

it("keeps the created workspace selected after a refresh and drops it in an organization that lacks it", async () => {
  vi.mocked(getAccessibleWorkspaces).mockResolvedValueOnce([workspace("main")]).mockResolvedValue([workspace("main"), workspace("operations")]);
  const capture: { value?: WorkspaceValue } = {};
  const first = render(<WorkspaceProvider><CaptureFirstRender capture={capture} /></WorkspaceProvider>);
  await screen.findByText("main", { selector: "output" });
  await act(async () => { await capture.value!.reload({ select: "operations" }); });
  first.unmount();

  // A browser refresh remounts the provider with the tab's stored selection.
  render(<WorkspaceProvider><View /></WorkspaceProvider>);
  await screen.findByText("main,operations");
  expect(screen.getByText("operations", { selector: "span" })).toBeTruthy();
  cleanup();

  // The new organization's accessible list does not contain the key, so it is not kept active.
  state.organization = { organizationId: "b", slug: "beta" };
  vi.mocked(getAccessibleWorkspaces).mockResolvedValue([workspace("allowed"), workspace("second")]);
  render(<WorkspaceProvider><View /></WorkspaceProvider>);
  await screen.findByText("allowed,second", { selector: "output" });
  expect(session.workspace()).toBeNull();
  expect(screen.getByText("no selection")).toBeTruthy();
});

it("does not reload workspace access when only the organization display data changes", async () => {
  session.setWorkspace("main");
  vi.mocked(getAccessibleWorkspaces).mockResolvedValue([workspace("main")]);
  const view = render(<WorkspaceProvider><View /></WorkspaceProvider>);
  await screen.findByText("main", { selector: "span" });
  state.organization = { organizationId: "a", slug: "alpha", organizationName: "Renamed" } as typeof state.organization;
  view.rerender(<WorkspaceProvider><View /></WorkspaceProvider>);
  expect(getAccessibleWorkspaces).toHaveBeenCalledTimes(1);
  expect(screen.getByText("main", { selector: "span" })).toBeTruthy();
});
