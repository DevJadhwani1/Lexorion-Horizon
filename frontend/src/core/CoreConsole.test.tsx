import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CoreRoutes } from "./CoreConsole";
import { CoreSessionProvider } from "./CoreSession";
import { session } from "../api/session";

const identity = { userId: "operator-id", email: "operator@core.test", organizationIds: [], coreOperator: true };
const response = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function mount(path = "/") { render(<CoreSessionProvider><MemoryRouter initialEntries={[path]}><CoreRoutes /></MemoryRouter></CoreSessionProvider>); }
function defaultResponse(path: string) {
  if (path === "/api/core/me") return response(identity);
  if (path === "/api/core/overview") return response({ users: 7, organizations: 3, products: 4, productGrants: 5 });
  if (path === "/api/core/me/organizations" || path === "/api/core/products") return response([]);
  throw new Error(`Unexpected API ${path}`);
}
beforeEach(() => { sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Core Console", () => {
  it("protects direct routes when signed out", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher); mount("/products");
    expect(await screen.findByRole("heading", { name: "Sign in to Core Console" })).toBeTruthy();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("restores Core identity and renders live counts without Horizon selectors", async () => {
    session.setTokens("access", "refresh"); session.setOrganization("horizon-only"); session.setWorkspace("payroll-only");
    const fetcher = vi.fn((path: string) => Promise.resolve(defaultResponse(path))); vi.stubGlobal("fetch", fetcher); mount();
    expect(await screen.findByText("7")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Core Console" }).querySelectorAll("a")).toHaveLength(9);
    expect(screen.queryByText("Workforce")).toBeNull(); expect(screen.queryByText("Entitlements")).toBeNull();
    for (const [path, init] of fetcher.mock.calls as unknown as [string, RequestInit][]) {
      expect(path.startsWith("/api/core/")).toBe(true);
      const headers = new Headers(init.headers); expect(headers.has("X-Lexorion-Organization")).toBe(false); expect(headers.has("X-Lexorion-Workspace")).toBe(false);
    }
  });
  it("does not give a product member global operator routes", async () => {
    session.setTokens("access", "refresh"); const fetcher = vi.fn(() => Promise.resolve(response({ ...identity, coreOperator: false })));
    vi.stubGlobal("fetch", fetcher); mount("/users");
    expect(await screen.findByRole("heading", { name: "Core operator access required" })).toBeTruthy();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("logs in and logs out through Core session APIs", async () => {
    const fetcher = vi.fn((path: string) => Promise.resolve(path === "/api/core/auth/login" ? response({ accessToken: "access", refreshToken: "refresh" }) : path === "/api/core/auth/logout" ? response(null, 204) : defaultResponse(path)));
    vi.stubGlobal("fetch", fetcher); mount("/login");
    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "operator@core.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Sign in to Core Console" })).toBeTruthy();
    expect(session.access()).toBeNull(); expect(fetcher.mock.calls.some(([path]) => path === "/api/core/auth/logout")).toBe(true);
  });
  it("refreshes an expired access token before restoring the console", async () => {
    session.setTokens("old", "refresh"); let meCalls = 0;
    const fetcher = vi.fn((path: string) => Promise.resolve(path === "/api/core/auth/refresh" ? response({ accessToken: "new", refreshToken: "rotated" }) : path === "/api/core/me" && meCalls++ === 0 ? response({ message: "Expired" }, 401) : defaultResponse(path)));
    vi.stubGlobal("fetch", fetcher); mount();
    expect(await screen.findByText("7")).toBeTruthy(); expect(session.access()).toBe("new"); expect(session.refresh()).toBe("rotated");
  });
  it("returns to sign-in when refresh is rejected", async () => {
    session.setTokens("old", "invalid"); vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(response({ message: "Expired" }, 401)))); mount("/products");
    expect(await screen.findByRole("heading", { name: "Sign in to Core Console" })).toBeTruthy(); expect(session.access()).toBeNull();
  });
  it("keeps a possibly valid credential and offers retry after a transient identity failure", async () => {
    session.setTokens("access", "refresh");
    const fetcher = vi.fn().mockResolvedValue(response({ message: "Temporarily unavailable" }, 503));
    vi.stubGlobal("fetch", fetcher); mount("/products");
    expect(await screen.findByRole("heading", { name: "Unable to verify your session" })).toBeTruthy();
    expect(session.access()).toBe("access");
    fetcher.mockImplementation((path: string) => Promise.resolve(defaultResponse(path)));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Products" })).toBeTruthy();
  });
  it("keeps the login form stable when an existing credential cannot be verified temporarily", async () => {
    session.setTokens("access", "refresh");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ message: "Temporarily unavailable" }, 503)));
    mount("/login");
    expect(await screen.findByRole("heading", { name: "Sign in to Core Console" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry identity check" })).toBeTruthy();
    expect(session.access()).toBe("access");
  });
  it("registers a product using the generic API and reloads persisted rows", async () => {
    session.setTokens("access", "refresh"); let products: unknown[] = [];
    const fetcher = vi.fn((path: string, init?: RequestInit) => {
      if (path === "/api/core/products" && init?.method === "POST") {
        const saved = { id: "travel-id", ...JSON.parse(String(init.body)) }; products = [saved]; return Promise.resolve(response(saved));
      }
      return Promise.resolve(path === "/api/core/products" ? response(products) : defaultResponse(path));
    }); vi.stubGlobal("fetch", fetcher); mount("/products");
    fireEvent.click(await screen.findByText("Register product"));
    fireEvent.change(screen.getByLabelText("Stable product key"), { target: { value: "lexorion-travel" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Lexorion Travel" } });
    fireEvent.change(screen.getByLabelText("Availability"), { target: { value: "true" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("Lexorion Travel")).toBeTruthy());
    expect(products).toEqual([{ id: "travel-id", key: "lexorion-travel", displayName: "Lexorion Travel", active: true }]);
  });
});
