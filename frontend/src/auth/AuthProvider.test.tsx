import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthProvider";
import { session } from "../api/session";

const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
let latestAuth: ReturnType<typeof useAuth>;
function ContextView() {
  const auth = useAuth();
  latestAuth = auth;
  return <span>{auth.loading ? "loading" : auth.organization?.slug ?? "no organization"}</span>;
}
const membership = (slug: string, lastWorkspaceKey: string | null = null) =>
  ({ organizationId: slug, organizationName: slug, slug, membershipRole: "EMPLOYEE", membershipStatus: "ACTIVE", organizationStatus: "ACTIVE", lastWorkspaceKey });
function stubServer(lastOrganizationSlug: string | null, memberships: unknown[]) {
  const fetcher = vi.fn((path: string, _init?: RequestInit) => Promise.resolve(
    path === "/api/platform/me/context" ? new Response(null, { status: 204 })
      : path === "/api/platform/me" ? response({ id: "user", email: "user@example.test", active: true, platformAccess: null, lastOrganizationSlug })
      : response(memberships)));
  vi.stubGlobal("fetch", fetcher);
  return { fetcher, saved: () => fetcher.mock.calls.filter(([path, init]) => path === "/api/platform/me/context" && init?.method === "PUT").map(([, init]) => JSON.parse(String(init!.body))) };
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

  it("preserves a requested workspace after switching to the verified handoff organization", async () => {
    window.history.replaceState({}, "", "/?organization=authorized&workspace=main");
    session.setOrganization("previous");
    session.setWorkspace("previous-workspace");
    session.setTokens("access", "refresh");
    vi.stubGlobal("fetch", vi.fn((path: string) => Promise.resolve(path === "/api/platform/me"
      ? response({ id: "user", email: "user@example.test", active: true, platformAccess: null })
      : response([{ organizationId: "org-1", organizationName: "Authorized", slug: "authorized", membershipRole: "ADMIN", membershipStatus: "ACTIVE", organizationStatus: "ACTIVE" }]))));
    render(<AuthProvider><ContextView /></AuthProvider>);
    await screen.findByText("authorized");
    expect(session.workspace()).toBe("main");
    expect(window.location.search).toBe("");
  });

  it("does not accept a workspace from an unauthorized organization handoff", async () => {
    window.history.replaceState({}, "", "/?organization=untrusted&workspace=foreign");
    session.setTokens("access", "refresh");
    vi.stubGlobal("fetch", vi.fn((path: string) => Promise.resolve(path === "/api/platform/me"
      ? response({ id: "user", active: true, platformAccess: null })
      : response([{ organizationId: "org-1", slug: "authorized", membershipStatus: "ACTIVE", organizationStatus: "ACTIVE" }]))));
    render(<AuthProvider><ContextView /></AuthProvider>);
    await screen.findByText("authorized");
    expect(session.workspace()).toBeNull();
  });
});

describe("last-used context restoration", () => {
  beforeEach(() => { sessionStorage.clear(); window.history.replaceState({}, "", "/"); session.setTokens("access", "refresh"); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("restores the server-remembered organization and its workspace when several are available", async () => {
    const server = stubServer("beta", [membership("alpha", "a-main"), membership("beta", "b-main")]);
    render(<AuthProvider><ContextView /></AuthProvider>);
    expect(screen.getByText("loading")).toBeTruthy();
    expect(await screen.findByText("beta")).toBeTruthy();
    expect(session.organization()).toBe("beta");
    expect(session.workspace()).toBe("b-main");
    expect(server.saved()).toEqual([]);
  });

  it("falls back to the selection flow when the remembered organization is no longer accessible", async () => {
    const server = stubServer("revoked", [membership("alpha"), membership("beta")]);
    render(<AuthProvider><ContextView /></AuthProvider>);
    expect(await screen.findByText("no organization")).toBeTruthy();
    expect(session.organization()).toBeNull();
    expect(server.saved()).toEqual([]);
  });

  it("selects and remembers the only available organization", async () => {
    const server = stubServer("revoked", [membership("alpha", "a-main")]);
    render(<AuthProvider><ContextView /></AuthProvider>);
    expect(await screen.findByText("alpha")).toBeTruthy();
    expect(session.workspace()).toBe("a-main");
    await waitFor(() => expect(server.saved()).toEqual([{ organizationSlug: "alpha" }]));
  });

  it("keeps this tab's verified selection on refresh without overwriting the server preference", async () => {
    session.setOrganization("alpha"); session.setWorkspace("tab-workspace");
    const server = stubServer("beta", [membership("alpha", "a-main"), membership("beta", "b-main")]);
    render(<AuthProvider><ContextView /></AuthProvider>);
    expect(await screen.findByText("alpha")).toBeTruthy();
    expect(session.workspace()).toBe("tab-workspace");
    expect(server.saved()).toEqual([]);
  });

  it("persists organization and workspace switches and restores each organization's workspace", async () => {
    const server = stubServer("alpha", [membership("alpha", "a-main"), membership("beta", "b-main")]);
    render(<AuthProvider><ContextView /></AuthProvider>);
    await screen.findByText("alpha");
    act(() => latestAuth.rememberWorkspace("alpha", "a-other"));
    act(() => latestAuth.selectOrganization("beta"));
    expect(await screen.findByText("beta")).toBeTruthy();
    expect(session.workspace()).toBe("b-main");
    act(() => latestAuth.selectOrganization("alpha"));
    expect(session.workspace()).toBe("a-other");
    await waitFor(() => expect(server.saved()).toEqual([
      { organizationSlug: "alpha", workspaceKey: "a-other" }, { organizationSlug: "beta" }, { organizationSlug: "alpha" },
    ]));
  });
});

describe("membership refresh after an organization rename", () => {
  beforeEach(() => { sessionStorage.clear(); window.history.replaceState({}, "", "/"); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("updates the selected organization's name in place without changing the session context", async () => {
    session.setTokens("access", "refresh");
    session.setOrganization("alpha");
    session.setWorkspace("main");
    let memberships = [{ ...membership("alpha"), organizationName: "Alpha" }];
    vi.stubGlobal("fetch", vi.fn((path: string) => Promise.resolve(path === "/api/platform/me"
      ? response({ id: "user", email: "user@example.test", active: true, platformAccess: null, lastOrganizationSlug: "alpha" })
      : response(memberships))));
    render(<AuthProvider><ContextView /></AuthProvider>);
    await screen.findByText("alpha");
    memberships = [{ ...membership("alpha"), organizationName: "Alpha Renamed" }];
    let refreshed = false;
    await act(async () => { refreshed = await latestAuth.refreshOrganizations(); });
    expect(refreshed).toBe(true);
    expect(latestAuth.organization?.organizationName).toBe("Alpha Renamed");
    expect(latestAuth.user).not.toBeNull();
    expect(session.organization()).toBe("alpha");
    expect(session.workspace()).toBe("main");
  });

  it("keeps the user signed in when the membership refresh fails", async () => {
    session.setTokens("access", "refresh");
    session.setOrganization("alpha");
    let failing = false;
    vi.stubGlobal("fetch", vi.fn((path: string) => Promise.resolve(failing ? new Response(null, { status: 503 })
      : path === "/api/platform/me" ? response({ id: "user", email: "user@example.test", active: true, platformAccess: null, lastOrganizationSlug: "alpha" })
      : response([membership("alpha")]))));
    render(<AuthProvider><ContextView /></AuthProvider>);
    await screen.findByText("alpha");
    failing = true;
    let refreshed = true;
    await act(async () => { refreshed = await latestAuth.refreshOrganizations(); });
    expect(refreshed).toBe(false);
    expect(latestAuth.user).not.toBeNull();
    expect(latestAuth.organization?.slug).toBe("alpha");
    expect(session.organization()).toBe("alpha");
  });
});
