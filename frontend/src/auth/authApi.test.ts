import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { restoreSession } from "./authApi";
import { session, usesSharedSessionCookie } from "../api/session";

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("shared host session restoration", () => {
  beforeEach(() => { sessionStorage.clear(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("restores through the HttpOnly cookie without sending credentials in the request URL or body", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ accessToken: "short-lived", refreshToken: null }));
    vi.stubGlobal("fetch", fetcher);

    expect(await restoreSession("admin.horizon.lexorion.in")).toBe(true);
    expect(session.access()).toBe("short-lived");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/core/auth/refresh");
    expect(init.credentials).toBe("include");
    expect(init.body).toBe("{}");
    expect(url).not.toMatch(/token|credential/i);
  });

  it("keeps localhost on origin-local authentication without requiring production DNS", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(usesSharedSessionCookie("localhost")).toBe(false);
    expect(await restoreSession("localhost")).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("treats rejected cookies as anonymous and keeps transient refresh failures recoverable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ message: "Invalid refresh token" }, 401)));
    expect(await restoreSession("horizon.lexorion.in")).toBe(false);
    expect(session.access()).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ message: "Temporarily unavailable" }, 503)));
    await expect(restoreSession("horizon.lexorion.in")).rejects.toMatchObject({ status: 503 });
    expect(session.access()).toBeNull();
  });
});
