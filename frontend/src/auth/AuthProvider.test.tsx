import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthProvider";
import { session } from "../api/session";

const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
function ContextView() {
  const auth = useAuth();
  return <span>{auth.loading ? "loading" : auth.organization?.slug ?? "no organization"}</span>;
}

describe("organization handoff", () => {
  beforeEach(() => { sessionStorage.clear(); window.history.replaceState({}, "", "/?organization=untrusted"); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, "", "/"); });

  it("only accepts a handed off organization after authenticated membership verification", async () => {
    session.setTokens("access", "refresh");
    vi.stubGlobal("fetch", vi.fn((path: string) => Promise.resolve(path === "/api/platform/me"
      ? response({ id: "user", email: "user@example.test", firstName: "A", lastName: "User", active: true, platformAccess: null })
      : response([
        { organizationId: "org-1", organizationName: "Authorized", slug: "authorized", membershipRole: "EMPLOYEE", membershipStatus: "ACTIVE", organizationStatus: "ACTIVE" },
        { organizationId: "org-2", organizationName: "Also authorized", slug: "also-authorized", membershipRole: "EMPLOYEE", membershipStatus: "ACTIVE", organizationStatus: "ACTIVE" },
      ]))));
    render(<AuthProvider><ContextView /></AuthProvider>);
    expect(await screen.findByText("no organization")).toBeTruthy();
    expect(session.organization()).toBeNull();
    expect(window.location.search).toBe("");
    expect(window.location.href).not.toMatch(/accessToken|refreshToken/);
  });

  it("accepts a handed off organization only when it matches an active server membership", async () => {
    window.history.replaceState({}, "", "/?organization=authorized");
    session.setTokens("access", "refresh");
    vi.stubGlobal("fetch", vi.fn((path: string) => Promise.resolve(path === "/api/platform/me"
      ? response({ id: "user", email: "user@example.test", firstName: "A", lastName: "User", active: true, platformAccess: null })
      : response([{ organizationId: "org-1", organizationName: "Authorized", slug: "authorized", membershipRole: "EMPLOYEE", membershipStatus: "ACTIVE", organizationStatus: "ACTIVE" }]))));
    render(<AuthProvider><ContextView /></AuthProvider>);
    expect(await screen.findByText("authorized")).toBeTruthy();
    expect(window.location.search).toBe("");
  });
});
