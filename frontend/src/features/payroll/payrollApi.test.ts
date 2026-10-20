import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { session } from "../../api/session";
import { getPayRunPreparation, savePayRunPreparation } from "./payrollApi";

beforeEach(() => { sessionStorage.clear(); session.setTokens("test", "refresh"); session.setOrganization("alpha"); session.setWorkspace("main"); });
afterEach(() => vi.unstubAllGlobals());
it("sends preparation selection as a JSON object through the real scoped HTTP client", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ready: true }), { headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);
  await savePayRunPreparation("RUN 1", ["EMP-1"]);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe("/api/payroll/pay-runs/RUN%201/preparation");
  expect(options.method).toBe("PUT");
  expect(JSON.parse(options.body)).toEqual({ employeeCodes: ["EMP-1"] });
  expect(new Headers(options.headers).get("X-Lexorion-Workspace")).toBe("main");
  expect(new Headers(options.headers).get("X-Lexorion-Organization")).toBe("alpha");
});
it("preserves server validation failures from preparation", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Duplicate employee in selection" }), { status: 409 })));
  await expect(savePayRunPreparation("RUN", ["EMP-1", "EMP-1"])).rejects.toMatchObject({ status: 409, message: "Duplicate employee in selection" });
});
it("does not return preparation from a previous workspace", async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => { finish = resolve; })));
  const response = getPayRunPreparation("RUN");
  const rejected = expect(response).rejects.toMatchObject({ name: "AbortError" });
  session.setWorkspace("other"); finish(new Response(JSON.stringify({ ready: true })));
  await rejected;
});
