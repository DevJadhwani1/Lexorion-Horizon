import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "./HomePage";

const state = vi.hoisted(() => ({
  organization: { organizationId: "org-1", organizationName: "Northwind", slug: "northwind", membershipRole: "ADMIN", organizationStatus: "ACTIVE" },
  organizations: [{ organizationId: "org-1", organizationName: "Northwind", slug: "northwind", membershipRole: "ADMIN", organizationStatus: "ACTIVE" }],
  workspace: { loading: false, error: "", workspaces: [], workspace: null },
}));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => state }));
vi.mock("../workspace/WorkspaceProvider", () => ({ useWorkspace: () => state.workspace }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("organization workspace setup guidance", () => {
  it("offers organization administrators the protected workspace setup flow", () => {
    state.organization.membershipRole = "ADMIN";
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText("No active workspaces are available for this organization.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Set up a workspace" }).getAttribute("href")).toBe("/app/admin/workspaces");
  });

  it("explains who can provision workspaces to non-admin members", () => {
    state.organization.membershipRole = "EMPLOYEE";
    state.organizations[0].membershipRole = "EMPLOYEE";
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getByText("Ask an organization administrator to provision a workspace and grant you access.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Set up a workspace" })).toBeNull();
  });
});
