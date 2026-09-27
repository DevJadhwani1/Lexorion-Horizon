import { describe, expect, it } from "vitest";
import { coreBase, isCoreConsole } from "./routing";
import { consoleHost, consoleUrl } from "../app/hostRouting";
describe("console routing", () => {
  it("selects Core only for its hostname or an explicit local path", () => {
    expect(isCoreConsole("core.lexorion.in", "/products")).toBe(true);
    expect(isCoreConsole("localhost", "/core/products")).toBe(true);
    expect(isCoreConsole("127.0.0.1", "/core")).toBe(true);
    expect(isCoreConsole("localhost", "/core-other")).toBe(false);
    expect(isCoreConsole("horizon.lexorion.in", "/core")).toBe(false);
    expect(isCoreConsole("admin.horizon.lexorion.in", "/")).toBe(false);
    expect(coreBase("core.lexorion.in")).toBe("/");
    expect(coreBase("localhost")).toBe("/core");
  });
  it("preserves existing Horizon routing", () => {
    expect(consoleHost("horizon.lexorion.in")).toBe("client");
    expect(consoleHost("admin.horizon.lexorion.in")).toBe("platform");
    expect(consoleHost("localhost")).toBe("local");
  });
  it("hands off only organization context and never credentials in URLs", () => {
    const url = new URL(consoleUrl("client", { organization: "northwind" }));
    expect(url.hostname).toBe("horizon.lexorion.in");
    expect(url.searchParams.get("organization")).toBe("northwind");
    expect([...url.searchParams.keys()]).toEqual(["organization"]);
    expect(url.href).not.toMatch(/token|credential|password/i);
  });
});
