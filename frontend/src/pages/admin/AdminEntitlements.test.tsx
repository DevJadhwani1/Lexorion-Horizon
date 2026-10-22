import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AdminEntitlements } from "./AdminEntitlements";
import type { EffectiveEntitlements } from "../../features/entitlements/entitlementApi";

describe("AdminEntitlements component", () => {
  afterEach(() => {
    cleanup();
  });
  const enterpriseSnapshot: EffectiveEntitlements = [
    {
      productKey: "organization",
      planKey: "enterprise",
      planName: "Enterprise Plan",
      entitlements: [
        { key: "workforce.enabled", valueType: "BOOLEAN", booleanValue: true, integerValue: null },
        { key: "payroll.enabled", valueType: "BOOLEAN", booleanValue: true, integerValue: null },
        { key: "payroll.processing", valueType: "BOOLEAN", booleanValue: true, integerValue: null },
        { key: "platform.employee_limit", valueType: "INTEGER", booleanValue: null, integerValue: 500 },
        { key: "platform.workspace_limit", valueType: "INTEGER", booleanValue: null, integerValue: 10 },
      ],
    },
  ];

  it("renders polished product access overview with available products and human-readable limits", () => {
    render(<AdminEntitlements entitlements={enterpriseSnapshot} />);

    // Products
    expect(screen.getByRole("heading", { name: "Workforce" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Payroll" })).toBeTruthy();

    // Both available badges
    const availableBadges = screen.getAllByText("Available");
    expect(availableBadges.length).toBe(2);

    // Human-readable limits
    expect(screen.getAllByText("Up to 500 employees").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Up to 10 workspaces").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Automated pay run processing")).toBeTruthy();

    // Verify raw keys and raw booleans are NEVER rendered
    expect(screen.queryByText(/workforce\.enabled/i)).toBeNull();
    expect(screen.queryByText(/payroll\.enabled/i)).toBeNull();
    expect(screen.queryByText(/payroll\.processing/i)).toBeNull();
    expect(screen.queryByText(/platform\.employee_limit/i)).toBeNull();
    expect(screen.queryByText(/platform\.workspace_limit/i)).toBeNull();
    expect(screen.queryByText(/true/i)).toBeNull();
  });

  it("handles disabled products with clear 'Not available' badge and guidance", () => {
    const starterWithoutPayroll: EffectiveEntitlements = [
      {
        productKey: "organization",
        planKey: "starter",
        planName: "Starter",
        entitlements: [
          { key: "workforce.enabled", valueType: "BOOLEAN", booleanValue: true, integerValue: null },
          { key: "payroll.enabled", valueType: "BOOLEAN", booleanValue: false, integerValue: null },
          { key: "platform.employee_limit", valueType: "INTEGER", booleanValue: null, integerValue: 25 },
          { key: "platform.workspace_limit", valueType: "INTEGER", booleanValue: null, integerValue: 1 },
        ],
      },
    ];

    render(<AdminEntitlements entitlements={starterWithoutPayroll} />);

    // Workforce is Available
    expect(screen.getByRole("heading", { name: "Workforce" })).toBeTruthy();
    expect(screen.getByText("Available")).toBeTruthy();
    expect(screen.getAllByText("Up to 25 employees").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Up to 1 workspace").length).toBeGreaterThanOrEqual(1);

    // Payroll is Not available
    expect(screen.getByRole("heading", { name: "Payroll" })).toBeTruthy();
    expect(screen.getByText("Not available")).toBeTruthy();
    expect(screen.getByText("This product is not enabled under your organization's current plan.")).toBeTruthy();
  });

  it("handles when all products are disabled under a restricted plan", () => {
    const restrictedSnapshot: EffectiveEntitlements = [
      {
        productKey: "organization",
        planKey: "custom",
        planName: "Basic Directory",
        entitlements: [
          { key: "workforce.enabled", valueType: "BOOLEAN", booleanValue: false, integerValue: null },
          { key: "payroll.enabled", valueType: "BOOLEAN", booleanValue: false, integerValue: null },
        ],
      },
    ];

    render(<AdminEntitlements entitlements={restrictedSnapshot} />);

    const notAvailableBadges = screen.getAllByText("Not available");
    expect(notAvailableBadges.length).toBe(2);
  });

  it("renders empty state when entitlements list is empty", () => {
    render(<AdminEntitlements entitlements={[]} />);
    expect(screen.getByText("No active organization plan or product entitlements found.")).toBeTruthy();
  });

  it("omits limits section when backend response contains no limits", () => {
    const noLimitsSnapshot: EffectiveEntitlements = [
      {
        productKey: "organization",
        planKey: "custom",
        planName: "Unlimited Tier",
        entitlements: [
          { key: "workforce.enabled", valueType: "BOOLEAN", booleanValue: true, integerValue: null },
          { key: "payroll.enabled", valueType: "BOOLEAN", booleanValue: true, integerValue: null },
        ],
      },
    ];

    render(<AdminEntitlements entitlements={noLimitsSnapshot} />);

    expect(screen.getByRole("heading", { name: "Workforce" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Payroll" })).toBeTruthy();
    expect(screen.queryByText(/Up to/)).toBeNull();
  });
});
