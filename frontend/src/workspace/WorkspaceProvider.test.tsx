import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceProvider";
import { getAccessibleWorkspaces, type OrganizationWorkspace } from "../features/admin/workspaceApi";
import { session } from "../api/session";

const state = vi.hoisted(() => ({ organization: { organizationId: "a" }, mode: "client" }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => state }));
vi.mock("../context/ApplicationContext", () => ({ useApplicationContext: () => state }));
vi.mock("../core/coreApi", () => ({ getProductAccess: vi.fn(async () => [{ productKey: "horizon" }]) }));
vi.mock("../features/admin/workspaceApi", () => ({ getAccessibleWorkspaces: vi.fn() }));

function View() {
  const value = useWorkspace();
  return <><output>{value.workspaces.map(item => item.key).join(",") || "empty"}</output>
    <span>{value.workspace?.key ?? "no selection"}</span>
    <button onClick={() => value.selectWorkspace("foreign")}>Select foreign</button></>;
}
function workspace(key: string): OrganizationWorkspace {
  return { key, displayName: key, status: "ACTIVE", productKey: "workforce", productName: "Workforce", products: [{ key: "workforce", displayName: "Workforce" }] };
}
beforeEach(() => { sessionStorage.clear(); state.organization = { organizationId: "a" }; vi.resetAllMocks(); });
afterEach(cleanup);

it("rejects a delayed workspace response from the previous organization", async () => {
  let finishOld!: (value: OrganizationWorkspace[]) => void;
  vi.mocked(getAccessibleWorkspaces).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockResolvedValueOnce([workspace("new")]);
  const view = render(<WorkspaceProvider><View /></WorkspaceProvider>);
  await waitFor(() => expect(getAccessibleWorkspaces).toHaveBeenCalledTimes(1));
  state.organization = { organizationId: "b" };
  view.rerender(<WorkspaceProvider><View /></WorkspaceProvider>);
  await screen.findByText("new");
  await act(async () => finishOld([workspace("old")]));
  expect(screen.queryByText("old")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("new");
});

it("clears a stale stored workspace and refuses an inaccessible selection", async () => {
  session.setWorkspace("foreign");
  vi.mocked(getAccessibleWorkspaces).mockResolvedValue([workspace("allowed")]);
  render(<WorkspaceProvider><View /></WorkspaceProvider>);
  await screen.findByText("allowed");
  expect(session.workspace()).toBeNull();
  fireEvent.click(screen.getByText("Select foreign"));
  expect(session.workspace()).toBeNull();
  expect(screen.getByText("no selection")).toBeTruthy();
});
