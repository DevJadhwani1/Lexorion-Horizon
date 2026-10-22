import { afterEach, expect, it, vi } from "vitest";
import { chooseOption } from "../../test/dropdown";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PlatformOrganizationsPage, PlatformOrganizationDetailPage } from "./PlatformOrganizationsPage";
import * as api from "../../features/platform/platformApi";

const state = vi.hoisted(() => ({
  org: { id: "org", name: "Flow company", organizationCode: "FLOW", slug: "flow", primaryEmail: "owner@example.test", status: "PENDING" },
  auth: { user: { id: "owner" }, organizations: [] as unknown[], reloadOrganizations: vi.fn(async () => {}) },
}));
vi.mock("../../auth/AuthProvider", () => ({ useAuth: () => state.auth }));
vi.mock("../../context/ApplicationContext", () => ({ useApplicationContext: () => ({ enterClient: vi.fn() }) }));
vi.mock("../../features/platform/platformApi", () => ({
  getPlatformOrganizations: vi.fn(async () => []), getPlatformUsers: vi.fn(async () => [{ id: "owner", email: "owner@example.test", status: "ACTIVE" }]),
  getPlatformOrganization: vi.fn(async () => state.org), getPlatformPlans: vi.fn(async () => [{ key: "starter", displayName: "Starter", status: "ACTIVE" }]),
  createPlatformOrganization: vi.fn(async () => state.org),
  activatePlatformOrganization: vi.fn(async () => ({ ...state.org, status: "ACTIVE" })),
  assignPlatformOrganizationPlan: vi.fn(async () => ({ ...state.org, status: "ACTIVE" })),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("connects organization creation to activation and plan assignment through existing APIs", async () => {
  render(<MemoryRouter initialEntries={["/app/platform/organizations"]}><Routes>
    <Route path="/app/platform/organizations" element={<PlatformOrganizationsPage />} />
    <Route path="/app/platform/organizations/:organizationId" element={<PlatformOrganizationDetailPage />} />
  </Routes></MemoryRouter>);
  await screen.findByText("owner@example.test");
  fireEvent.click(screen.getByText("Create organization", { selector: "summary" }));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Flow company" } });
  fireEvent.change(screen.getByLabelText("Organization code"), { target: { value: "FLOW" } });
  fireEvent.change(screen.getByLabelText("Primary email"), { target: { value: "owner@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Create organization" }));
  await screen.findByRole("button", { name: "Activate organization" });
  expect(api.createPlatformOrganization).toHaveBeenCalledWith({ name: "Flow company", organizationCode: "FLOW", primaryEmail: "owner@example.test", ownerUserId: "owner" });
  fireEvent.click(screen.getByRole("button", { name: "Activate organization" }));
  await screen.findByText("Organization activated. Assign a plan before workspace setup.");
  expect(api.activatePlatformOrganization).toHaveBeenCalledWith("org");
  chooseOption("Organization plan", "Starter");
  fireEvent.click(screen.getByRole("button", { name: "Assign plan" }));
  await waitFor(() => expect(api.assignPlatformOrganizationPlan).toHaveBeenCalledWith("org", "starter"));
  await screen.findByText("Plan assigned. The organization administrator can now create a workspace.");
});
