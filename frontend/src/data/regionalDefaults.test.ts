import { expect, it } from "vitest";
import { isUntouchedServerDefault, regionalDefaultsFor } from "./regionalDefaults";

it("suggests Indian regional defaults", () => {
  expect(regionalDefaultsFor("in")).toEqual({ currency: "INR", timeZone: "Asia/Kolkata", dateFormat: "DD/MM/YYYY", locale: "en-IN" });
  expect(regionalDefaultsFor("ZZ")).toBeNull();
});

it("recognises settings no one has changed yet", () => {
  expect(isUntouchedServerDefault({ country: "US", currency: "USD", timeZone: "UTC", dateFormat: "YYYY-MM-DD", locale: "en-US" })).toBe(true);
  expect(isUntouchedServerDefault({ country: "IN", currency: "INR", timeZone: "Asia/Kolkata", dateFormat: "DD/MM/YYYY", locale: "en-IN" })).toBe(false);
});
