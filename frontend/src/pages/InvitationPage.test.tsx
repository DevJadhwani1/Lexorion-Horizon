import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InvitationPage } from "./InvitationPage";
import { apiRequest } from "../api/httpClient";
const auth = vi.hoisted(() => ({ user: null as null | { email: string }, login: vi.fn(), logout: vi.fn(), reloadOrganizations: vi.fn() }));
vi.mock("../api/httpClient", () => ({ apiRequest: vi.fn() }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => auth }));
beforeEach(() => { window.history.replaceState({}, "", "/invitations/accept#token=controlled-test-token"); auth.user = null; });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("loads an invitation without stale organization or authentication selectors", async () => {
  vi.mocked(apiRequest).mockResolvedValue({ email: "new@example.test", organizationName: "QA", organizationSlug: "qa", accountExists: false });
  render(<InvitationPage />);
  await screen.findByRole("button", { name: "Create account and accept" });
  expect(apiRequest).toHaveBeenCalledWith("/api/invitations/preview", expect.objectContaining({ authenticated: false, organizationScoped: false }));
  expect(screen.getByLabelText("First name")).toBeTruthy();
});
it("shows expired or revoked errors instead of an acceptance form", async () => {
  vi.mocked(apiRequest).mockRejectedValue(new Error("Invitation has expired or is no longer pending"));
  render(<InvitationPage />);
  await screen.findByText("Invitation has expired or is no longer pending");
  expect(screen.queryByRole("button", { name: "Accept invitation" })).toBeNull();
});
it("blocks the wrong signed-in account and provides sign out", async () => {
  auth.user = { email: "wrong@example.test" };
  vi.mocked(apiRequest).mockResolvedValue({ email: "recipient@example.test", organizationName: "QA", organizationSlug: "qa", accountExists: true });
  render(<InvitationPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
  await waitFor(() => expect(auth.logout).toHaveBeenCalled());
  expect(screen.queryByRole("button", { name: "Accept invitation" })).toBeNull();
});

it("loads the rotated invitation when a resent link changes only the URL fragment", async () => {
  vi.mocked(apiRequest).mockRejectedValueOnce(new Error("Invitation is invalid"));
  render(<InvitationPage />);
  await screen.findByText("Invitation is invalid");
  vi.mocked(apiRequest).mockResolvedValue({ email: "recipient@example.test", organizationName: "QA", organizationSlug: "qa", accountExists: true });
  window.history.replaceState({}, "", "/invitations/accept#token=rotated-invitation-token");
  fireEvent(window, new HashChangeEvent("hashchange"));
  await screen.findByLabelText("Password");
  expect(apiRequest).toHaveBeenLastCalledWith("/api/invitations/preview", expect.objectContaining({ body: { token: "rotated-invitation-token" } }));
  expect(screen.queryByText("Invitation is invalid")).toBeNull();
});
