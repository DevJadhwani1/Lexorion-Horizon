import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { apiRequest } from "./httpClient";
import { session } from "./session";

beforeEach(() => { sessionStorage.clear(); session.setOrganization("alpha"); session.setWorkspace("main"); session.setTokens("old", "refresh"); });
afterEach(() => vi.unstubAllGlobals());
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

it("does not replay a mutation in a workspace selected during refresh", async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.fn().mockResolvedValueOnce(json({},401)).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  vi.stubGlobal("fetch", fetcher);
  const result = apiRequest("/api/payroll/pay-runs/RUN/process", { method: "POST" });
  const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  session.setWorkspace("other"); finish(json({ accessToken: "new", refreshToken: "next" }));
  await rejected;
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(new Headers(fetcher.mock.calls[0][1].headers).get("X-Lexorion-Workspace")).toBe("main");
});

it("discards a delayed response across organizations sharing the same workspace key", async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => { finish = resolve; })));
  const result = apiRequest("/api/workforce/employees");
  const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
  session.setOrganization("beta"); finish(json([{ employeeCode: "ALPHA-PRIVATE" }]));
  await rejected;
});

it("invalidates a request even when the user switches away and back", async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => { finish = resolve; })));
  const result = apiRequest("/api/workforce/employees");
  const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
  session.setWorkspace("other"); session.setWorkspace("main"); finish(json([])); await rejected;
});

it("refreshes normally while preserving the original organization, workspace and body", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json({},401)).mockResolvedValueOnce(json({ accessToken: "new", refreshToken: "next" })).mockResolvedValueOnce(json({ status: "CALCULATED" }));
  vi.stubGlobal("fetch", fetcher);
  await expect(apiRequest("/api/payroll/pay-runs/RUN/process", { method: "POST", body: { example: 1 } })).resolves.toEqual({ status: "CALCULATED" });
  const options = fetcher.mock.calls[2][1];
  expect(new Headers(options.headers).get("X-Lexorion-Organization")).toBe("alpha");
  expect(new Headers(options.headers).get("X-Lexorion-Workspace")).toBe("main");
  expect(new Headers(options.headers).get("Authorization")).toBe("Bearer new");
  expect(options.body).toBe('{"example":1}');
});

it("does not restore the previous session when refresh completes after sign-out", async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.fn().mockResolvedValueOnce(json({},401)).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  vi.stubGlobal("fetch", fetcher);
  const request = apiRequest("/api/payroll/readiness");
  const rejected = expect(request).rejects.toMatchObject({ name: "AbortError" });
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  session.clearTokens(); finish(json({ accessToken: "late", refreshToken: "late-refresh" }));
  await rejected; expect(session.access()).toBeNull(); expect(session.refresh()).toBeNull();
});

it("throws an expected status without showing it as a global error", async () => {
  const reported = vi.fn();
  window.addEventListener("lexorion:api-error", reported);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Payroll employee not found" }), { status: 404 })));
  await expect(apiRequest("/api/payroll/employees/EMP-9", { expectedStatuses: [404] })).rejects.toMatchObject({ status: 404 });
  expect(reported).not.toHaveBeenCalled();
  await expect(apiRequest("/api/payroll/employees/EMP-9")).rejects.toMatchObject({ status: 404 });
  expect(reported).toHaveBeenCalledOnce();
  window.removeEventListener("lexorion:api-error", reported);
  vi.unstubAllGlobals();
});
