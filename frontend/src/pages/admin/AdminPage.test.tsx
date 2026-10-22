import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdminPage } from "./AdminPage";
import type { Organization } from "../../features/admin/adminApi";
import { getOrganization, updateOrganization, updateSettings } from "../../features/admin/adminApi";

vi.mock("../../theme/ThemeProvider", () => ({ useTheme: () => ({ t: {} }) }));
const mockRefreshOrganizations = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ refreshOrganizations: mockRefreshOrganizations }),
  useOptionalAuth: () => ({ refreshOrganizations: mockRefreshOrganizations }),
}));

const testState = vi.hoisted(() => {
  const initialMockOrg: Organization = {
    name: "Lexorion Corp",
    legalName: "Lexorion Global Holdings Inc.",
    organizationCode: "LEX-GLOBAL",
    slug: "lexorion-corp",
    primaryEmail: "admin@lexorion.test",
    primaryPhone: "+919876543210",
    status: "ACTIVE",
    description: "Global enterprise software platform",
    industry: "Enterprise Software & SaaS",
    companySize: "LARGE",
    website: "https://lexorion.com",
    addressLine1: "100 Innovation Way",
    addressLine2: "Suite 400",
    addressCountry: "IN",
    stateProvince: "Karnataka",
    city: "Bengaluru",
    postalCode: "560001",
    settings: {
      country: "IN",
      currency: "INR",
      timeZone: "Asia/Kolkata",
      dateFormat: "DD/MM/YYYY",
      locale: "en-US",
      workingDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
      brandingDisplayName: "Lexorion Portal",
      primaryColor: "#175CD3",
      secondaryColor: "#027A48",
    },
  };

  const defaultEntitlements = [
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

  return {
    initialMockOrg,
    org: JSON.parse(JSON.stringify(initialMockOrg)) as Organization,
    shouldFail: false,
    updateShouldFail: false,
    updateSettingsShouldFail: false,
    defaultEntitlements,
    entitlements: JSON.parse(JSON.stringify(defaultEntitlements)),
    entitlementsShouldFail: false,
    members: [
      {
        membershipId: "mem-1",
        fullName: "Dev Jadhwani",
        email: "dev@lexorion.in",
        role: "ADMIN",
        status: "ACTIVE",
      },
    ],
  };
});

vi.mock("../../features/entitlements/entitlementApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../features/entitlements/entitlementApi")>();
  return {
    ...actual,
    getEffectiveEntitlements: vi.fn(async () => {
      if (testState.entitlementsShouldFail) throw new Error("Failed to load entitlements");
      return testState.entitlements;
    }),
  };
});

vi.mock("../../features/admin/adminApi", () => ({
  getOrganization: vi.fn(async () => {
    if (testState.shouldFail) throw new Error("Network connection lost");
    return testState.org;
  }),
  updateOrganization: vi.fn(async (body: Partial<Organization>) => {
    if (testState.updateShouldFail) throw new Error("Failed to update organization profile");
    const updated = { ...testState.org };
    for (const [key, value] of Object.entries(body)) {
      if (key === "name" || key === "primaryEmail") {
        if (!value || typeof value !== "string" || !value.trim()) {
          throw new Error(`${key} must not be blank`);
        }
        (updated as Record<string, unknown>)[key] = value.trim();
      } else if (value === null || value === undefined || (typeof value === "string" && !value.trim())) {
        (updated as Record<string, unknown>)[key] = null;
      } else {
        (updated as Record<string, unknown>)[key] = value;
      }
    }
    testState.org = updated as Organization;
    return testState.org;
  }),
  // Mirrors TenantAdministrationService.updateSettings: omitted and null fields are unchanged; strings are trimmed to null.
  updateSettings: vi.fn(async (body: Record<string, unknown>) => {
    if (testState.updateSettingsShouldFail) throw new Error("Failed to update organization settings");
    const settings: Record<string, unknown> = { ...testState.org.settings };
    for (const [key, value] of Object.entries(body)) {
      if (value === null || value === undefined) continue;
      settings[key] = typeof value === "string" ? value.trim() || null : value;
    }
    testState.org = { ...testState.org, settings: settings as unknown as Organization["settings"] };
    return testState.org;
  }),
  getMembers: vi.fn(async () => testState.members),
  getInvitations: vi.fn(async () => []),
  changeMemberRole: vi.fn(async () => {}),
  removeMember: vi.fn(async () => {}),
  createInvitation: vi.fn(async () => {}),
  revokeInvitation: vi.fn(async () => {}),
  resendInvitation: vi.fn(async () => {}),
}));

beforeEach(() => {
  testState.org = JSON.parse(JSON.stringify(testState.initialMockOrg));
  testState.shouldFail = false;
  testState.updateShouldFail = false;
  testState.updateSettingsShouldFail = false;
  testState.entitlements = JSON.parse(JSON.stringify(testState.defaultEntitlements));
  testState.entitlementsShouldFail = false;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderAdminPage(section = "organization") {
  return render(
    <MemoryRouter initialEntries={[`/app/admin/${section}`]}>
      <Routes>
        <Route path="/app/admin/:section" element={<AdminPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminPage - Organization Profile Form", () => {
  it("renders organization profile fields with standards and pre-populated values", async () => {
    renderAdminPage("organization");

    await waitFor(() => {
      expect(screen.getByDisplayValue("Lexorion Corp")).toBeTruthy();
    });

    expect(screen.getByDisplayValue("Lexorion Global Holdings Inc.")).toBeTruthy();
    expect(screen.getByDisplayValue("admin@lexorion.test")).toBeTruthy();

    // Primary Phone: displays calling code and local digits
    expect(screen.getByText("+91")).toBeTruthy();
    expect(screen.getByDisplayValue("9876543210")).toBeTruthy();

    // Website: displays saved string value without prefix addon
    expect(screen.getByDisplayValue("https://lexorion.com")).toBeTruthy();

    // Industry dropdown
    expect(screen.getByText("Enterprise Software & SaaS")).toBeTruthy();

    // Country dropdown
    expect(screen.getByText(/India \(IN\)/)).toBeTruthy();

    // Address fields
    expect(screen.getByDisplayValue("100 Innovation Way")).toBeTruthy();
    expect(screen.getByDisplayValue("Suite 400")).toBeTruthy();
    expect(screen.getByDisplayValue("Karnataka")).toBeTruthy();
    expect(screen.getByDisplayValue("Bengaluru")).toBeTruthy();
    expect(screen.getByDisplayValue("560001")).toBeTruthy();
  });

  it("submits updated organization profile with plain-string website value", async () => {
    renderAdminPage("organization");

    await waitFor(() => {
      expect(screen.getByDisplayValue("Lexorion Corp")).toBeTruthy();
    });

    // Update website input with plain-string address
    const websiteInput = screen.getByRole("textbox", { name: /website/i });
    fireEvent.change(websiteInput, { target: { value: "www.lexorion.com/about" } });

    // Submit form
    const saveButton = screen.getByRole("button", { name: /save profile changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Lexorion Corp",
          website: "www.lexorion.com/about",
          primaryPhone: "+919876543210",
          industry: "Enterprise Software & SaaS",
          addressCountry: "IN",
        })
      );
    });

    // Success notification displayed
    expect(await screen.findByText(/organization profile updated successfully/i)).toBeTruthy();
  });

  it("preserves plain-string website address without forcing protocol on edit and save", async () => {
    testState.org = {
      ...testState.org,
      website: "www.lexorion.corp",
    };

    renderAdminPage("organization");

    await waitFor(() => {
      expect(screen.getByDisplayValue("www.lexorion.corp")).toBeTruthy();
    });

    const websiteInput = screen.getByRole("textbox", { name: /website/i });
    fireEvent.change(websiteInput, { target: { value: "portal.lexorion.com" } });

    const saveButton = screen.getByRole("button", { name: /save profile changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          website: "portal.lexorion.com",
        })
      );
    });
  });

  it("rejects unsupported protocols in website and blocks submission", async () => {
    renderAdminPage("organization");

    await waitFor(() => {
      expect(screen.getByDisplayValue("Lexorion Corp")).toBeTruthy();
    });

    const websiteInput = screen.getByRole("textbox", { name: /website/i });
    fireEvent.change(websiteInput, { target: { value: "javascript:alert(1)" } });

    const form = document.querySelector("form.admin-form-container")!;
    fireEvent.submit(form);
    const errors = await screen.findAllByText(/protocols like javascript:, data:, and file: are prohibited/i);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(updateOrganization).not.toHaveBeenCalled();
  });

  it("preserves legacy unlisted industry value", async () => {
    testState.org = {
      ...testState.org,
      industry: "Bespoke Legal Tech Advisory",
    };

    renderAdminPage("organization");

    await waitFor(() => {
      expect(screen.getByText("Bespoke Legal Tech Advisory")).toBeTruthy();
    });
  });

  it("replaces, clears, saves, and reloads address fields without concatenating values", async () => {
    renderAdminPage("organization");

    await waitFor(() => {
      expect(screen.getByDisplayValue("Karnataka")).toBeTruthy();
    });

    const stateInput = screen.getByLabelText("State / Province / Region") as HTMLInputElement;
    const cityInput = screen.getByLabelText("City") as HTMLInputElement;
    const postalInput = screen.getByLabelText("Postal / ZIP Code") as HTMLInputElement;

    fireEvent.change(stateInput, { target: { value: "Maharashtra" } });
    fireEvent.change(stateInput, { target: { value: "Karnataka" } });
    fireEvent.change(cityInput, { target: { value: "Mumbai" } });
    fireEvent.change(cityInput, { target: { value: "Bengaluru" } });
    fireEvent.change(postalInput, { target: { value: "400001" } });
    fireEvent.change(postalInput, { target: { value: "560001" } });

    expect(stateInput.value).toBe("Karnataka");
    expect(cityInput.value).toBe("Bengaluru");
    expect(postalInput.value).toBe("560001");

    fireEvent.focus(stateInput);
    expect(stateInput.selectionStart).toBe(0);
    expect(stateInput.selectionEnd).toBe(stateInput.value.length);
    fireEvent.change(stateInput, { target: { value: "Maharashtra" } });
    expect(stateInput.value).toBe("Maharashtra");
    fireEvent.change(stateInput, { target: { value: "Karnataka" } });

    fireEvent.change(cityInput, { target: { value: "" } });
    expect(cityInput.value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: /save profile changes/i }));

    await waitFor(() => {
      expect(updateOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          stateProvince: "Karnataka",
          city: null,
          postalCode: "560001",
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Karnataka")).toBeTruthy();
      expect(screen.getByDisplayValue("560001")).toBeTruthy();
    });
    expect((screen.getByLabelText("City") as HTMLInputElement).value).toBe("");
  });

  it("validates primary email as non-blank and formatted before submission", async () => {
    renderAdminPage("organization");

    await waitFor(() => {
      expect(screen.getByDisplayValue("admin@lexorion.test")).toBeTruthy();
    });

    const emailInput = screen.getByRole("textbox", { name: /primary email/i });
    const form = emailInput.closest("form")!;

    // Test blank email
    fireEvent.change(emailInput, { target: { value: "   " } });
    fireEvent.submit(form);

    expect(await screen.findByText(/primary email is required/i)).toBeTruthy();
    expect(updateOrganization).not.toHaveBeenCalled();

    // Test invalid format
    fireEvent.change(emailInput, { target: { value: "invalid-email" } });
    fireEvent.submit(form);

    expect(await screen.findByText(/please provide a valid primary email address/i)).toBeTruthy();
    expect(updateOrganization).not.toHaveBeenCalled();
  });

  it("preserves user edits and displays error when save request fails", async () => {
    renderAdminPage("organization");

    await waitFor(() => {
      expect(screen.getByDisplayValue("Lexorion Corp")).toBeTruthy();
    });

    testState.updateShouldFail = true;

    const legalNameInput = screen.getByRole("textbox", { name: /legal entity name/i });
    fireEvent.change(legalNameInput, { target: { value: "Tentative Entity Name Change" } });

    fireEvent.click(screen.getByRole("button", { name: /save profile changes/i }));

    expect(await screen.findByText(/failed to update organization profile/i)).toBeTruthy();
    // User edit is preserved in input
    expect((screen.getByRole("textbox", { name: /legal entity name/i }) as HTMLInputElement).value).toBe("Tentative Entity Name Change");
  });

  it("explicitly clears optional fields by persisting null and refreshes form", async () => {
    renderAdminPage("organization");

    await waitFor(() => {
      expect(screen.getByDisplayValue("Lexorion Corp")).toBeTruthy();
    });

    // Clear legal entity name and website
    const legalNameInput = screen.getByRole("textbox", { name: /legal entity name/i });
    const websiteInput = screen.getByRole("textbox", { name: /website/i });
    fireEvent.change(legalNameInput, { target: { value: "" } });
    fireEvent.change(websiteInput, { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: /save profile changes/i }));

    await waitFor(() => {
      expect(updateOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          legalName: null,
          website: null,
        })
      );
    });

    // Success notice displayed
    expect(await screen.findByText(/organization profile updated successfully/i)).toBeTruthy();
    // Persisted state has null for cleared fields
    expect(testState.org.legalName).toBeNull();
    expect(testState.org.website).toBeNull();
  });
});

describe("AdminPage - Organization Settings Form", () => {
  it("renders settings fields with regional standards", async () => {
    renderAdminPage("settings");

    await waitFor(() => {
      expect(screen.getByText("Regional & Localization Defaults")).toBeTruthy();
    });

    // Country
    expect(screen.getByText(/India \(IN\)/)).toBeTruthy();
    // Currency
    expect(screen.getByText(/Indian Rupee \(INR ₹\)/)).toBeTruthy();
    // Timezone
    expect(screen.getByText((content) => content.includes("Asia/Kolkata"))).toBeTruthy();
    // Date Format
    expect(screen.getByText(/DD\/MM\/YYYY/)).toBeTruthy();
  });

  it("submits updated organization settings with canonical identifiers", async () => {
    renderAdminPage("settings");

    await waitFor(() => {
      expect(screen.getByText("Regional & Localization Defaults")).toBeTruthy();
    });

    // Submit form
    const saveButton = screen.getByRole("button", { name: /save settings changes/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          country: "IN",
          currency: "INR",
          timeZone: "Asia/Kolkata",
          dateFormat: "DD/MM/YYYY",
        })
      );
    });

    expect(await screen.findByText(/organization settings updated successfully/i)).toBeTruthy();
  });

  it("displays dirty indicator when field is modified and clears on successful save", async () => {
    renderAdminPage("settings");

    await waitFor(() => {
      expect(screen.getByText("Regional & Localization Defaults")).toBeTruthy();
    });

    // Initially clean
    expect(screen.queryByTestId("settings-dirty-indicator")).toBeNull();
    expect(screen.queryByText(/Unsaved changes/i)).toBeNull();

    // Modify branding display name
    const brandingInput = screen.getByLabelText(/Branding Display Name/i);
    fireEvent.change(brandingInput, { target: { value: "Horizon Global" } });

    // Dirty indicators appear
    expect(screen.getByTestId("settings-dirty-indicator")).toBeTruthy();
    expect(screen.getByText("Unsaved changes")).toBeTruthy();

    // Save changes
    const saveButton = screen.getByRole("button", { name: /save settings changes/i });
    fireEvent.click(saveButton);

    expect(await screen.findByText(/organization settings updated successfully/i)).toBeTruthy();

    // Dirty indicator clears after successful save
    await waitFor(() => {
      expect(screen.queryByTestId("settings-dirty-indicator")).toBeNull();
    });
  });

  it("preserves user edits and displays error notice when settings save fails", async () => {
    testState.updateSettingsShouldFail = true;
    renderAdminPage("settings");

    await waitFor(() => {
      expect(screen.getByText("Regional & Localization Defaults")).toBeTruthy();
    });

    const brandingInput = screen.getByLabelText(/Branding Display Name/i) as HTMLInputElement;
    fireEvent.change(brandingInput, { target: { value: "Failed Save Attempt" } });

    const saveButton = screen.getByRole("button", { name: /save settings changes/i });
    fireEvent.click(saveButton);

    expect(await screen.findByText("Failed to update organization settings")).toBeTruthy();

    // User's edit is preserved despite failure
    expect(brandingInput.value).toBe("Failed Save Attempt");
    expect(screen.getByTestId("settings-dirty-indicator")).toBeTruthy();
  });
});

describe("AdminPage - Error handling and retry", () => {
  it("displays actionable error notice and retry button when API load fails", async () => {
    testState.shouldFail = true;

    renderAdminPage("organization");

    expect(await screen.findByText("Network connection lost")).toBeTruthy();
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    expect(retryBtn).toBeTruthy();

    // Clicking retry after fixing error reloads data
    testState.shouldFail = false;
    fireEvent.click(retryBtn);

    expect(await screen.findByDisplayValue("Lexorion Corp")).toBeTruthy();
  });
});

function renderSettingsSection(section: "settings" | "product-access") {
  return render(
    <MemoryRouter initialEntries={[section === "settings" ? "/app/organization/settings" : "/app/organization/settings/product-access"]}>
      <Routes>
        <Route path="/app/organization/settings" element={<AdminPage key="settings" sectionKey="settings" />} />
        <Route path="/app/organization/settings/product-access" element={<AdminPage key="product-access" sectionKey="product-access" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminPage - Settings > Product access", () => {
  it("renders Product access inside Settings with backend availability and allowances", async () => {
    renderSettingsSection("product-access");

    expect(await screen.findByRole("heading", { name: "Product access" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeTruthy();

    const sections = screen.getByRole("navigation", { name: "Settings sections" });
    expect(sections.querySelector('a[href="/app/organization/settings"]')?.textContent).toBe("General");
    expect(sections.querySelector('a[href="/app/organization/settings/product-access"]')?.classList.contains("active")).toBe(true);

    expect(screen.getByRole("heading", { name: "Workforce" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Payroll" })).toBeTruthy();
    expect(screen.getAllByText("Available").length).toBe(2);

    expect(screen.getAllByText("Up to 500 employees").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Up to 10 workspaces").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Automated pay run processing")).toBeTruthy();

    // Key capabilities are no longer shown
    expect(screen.queryByText(/capabilities/i)).toBeNull();

    // Read-only: no edit, purchase, or upgrade actions
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();

    // Raw keys are never shown
    expect(screen.queryByText(/workforce\.enabled/i)).toBeNull();
    expect(screen.queryByText(/payroll\.processing/i)).toBeNull();
    expect(screen.queryByText(/platform\.employee_limit/i)).toBeNull();
    expect(screen.queryByText(/platform\.workspace_limit/i)).toBeNull();
  });

  it("reflects the plan allowances returned by the backend", async () => {
    testState.entitlements = [
      {
        productKey: "organization",
        planKey: "growth",
        planName: "Growth",
        entitlements: [
          { key: "workforce.enabled", valueType: "BOOLEAN", booleanValue: true, integerValue: null },
          { key: "payroll.enabled", valueType: "BOOLEAN", booleanValue: true, integerValue: null },
          { key: "payroll.processing", valueType: "BOOLEAN", booleanValue: false, integerValue: null },
          { key: "platform.employee_limit", valueType: "INTEGER", booleanValue: null, integerValue: 120 },
          { key: "platform.workspace_limit", valueType: "INTEGER", booleanValue: null, integerValue: 3 },
        ],
      },
    ];

    renderSettingsSection("product-access");

    expect(await screen.findByRole("heading", { name: "Workforce" })).toBeTruthy();
    expect(screen.getAllByText("Up to 120 employees").length).toBe(2);
    expect(screen.getByText("Up to 3 workspaces")).toBeTruthy();
    expect(screen.queryByText("Up to 500 employees")).toBeNull();
    expect(screen.queryByText("Automated pay run processing")).toBeNull();
  });

  it("renders unavailable products with a Not available badge and guidance", async () => {
    testState.entitlements = [
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

    renderSettingsSection("product-access");

    expect(await screen.findByRole("heading", { name: "Workforce" })).toBeTruthy();
    expect(screen.getByText("Available")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Payroll" })).toBeTruthy();
    expect(screen.getByText("Not available")).toBeTruthy();
    expect(screen.getByText("This product is not enabled under your organization's current plan.")).toBeTruthy();
  });

  it("renders the empty state when the organization has no plan entitlements", async () => {
    testState.entitlements = [];
    renderSettingsSection("product-access");
    expect(await screen.findByText("No active organization plan or product entitlements found.")).toBeTruthy();
  });

  it("shows a loading state within Settings", async () => {
    renderSettingsSection("product-access");
    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Settings sections" })).toBeTruthy();
    await screen.findByRole("heading", { name: "Workforce" });
  });

  it("displays an error notice and retry when the entitlements request fails", async () => {
    testState.entitlementsShouldFail = true;

    renderSettingsSection("product-access");

    expect(await screen.findByText("Failed to load entitlements")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Settings sections" })).toBeTruthy();
    // Does NOT silently display false "Not available" products on API error
    expect(screen.queryByRole("heading", { name: "Workforce" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Payroll" })).toBeNull();

    testState.entitlementsShouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByRole("heading", { name: "Workforce" })).toBeTruthy();
  });

  it("switches between General and Product access from the section navigation", async () => {
    renderSettingsSection("settings");
    expect(await screen.findByRole("button", { name: "Save Settings Changes" })).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "Product access" }));
    expect(await screen.findByRole("heading", { name: "Workforce" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save Settings Changes" })).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "General" }));
    expect(await screen.findByRole("button", { name: "Save Settings Changes" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Workforce" })).toBeNull();
  });

  it("marks General active on the Settings form and keeps the form working", async () => {
    renderSettingsSection("settings");

    expect(await screen.findByRole("button", { name: "Save Settings Changes" })).toBeTruthy();
    const sections = screen.getByRole("navigation", { name: "Settings sections" });
    expect(sections.querySelector('a[href="/app/organization/settings"]')?.classList.contains("active")).toBe(true);
    expect(sections.querySelector('a[href="/app/organization/settings/product-access"]')?.classList.contains("active")).toBe(false);
  });
});

describe("AdminPage - Members & Invitations custom dropdowns", () => {
  it("renders custom dropdown for member role and changes role with confirmation", async () => {
    const { changeMemberRole } = await import("../../features/admin/adminApi");
    vi.spyOn(window, "confirm").mockImplementation(() => true);
    renderAdminPage("members");

    await waitFor(() => {
      expect(screen.getByText("Dev Jadhwani")).toBeTruthy();
    });

    // Custom dropdown trigger for Role
    const roleTrigger = screen.getByRole("combobox", { name: /role for dev jadhwani/i });
    expect(roleTrigger).toBeTruthy();
    expect(roleTrigger.getAttribute("aria-expanded")).toBe("false");

    // Click to open custom dropdown
    fireEvent.click(roleTrigger);
    expect(roleTrigger.getAttribute("aria-expanded")).toBe("true");

    // Search input should NOT be present (searchable=false)
    expect(screen.queryByPlaceholderText("Search...")).toBeNull();

    // Verify custom dropdown options
    expect(screen.getByRole("option", { name: "ADMIN" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "MANAGER" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "EMPLOYEE" })).toBeTruthy();

    // Click MANAGER
    fireEvent.click(screen.getByRole("option", { name: "MANAGER" }));

    expect(window.confirm).toHaveBeenCalledWith("Change Dev Jadhwani's role to MANAGER?");
    expect(changeMemberRole).toHaveBeenCalledWith("mem-1", "MANAGER");
  });

  it("renders custom dropdown for role in invitations toolbar", async () => {
    renderAdminPage("invitations");

    await waitFor(() => {
      expect(screen.getByText("Manage team invitations and delivery status.")).toBeTruthy();
    });

    const roleTrigger = screen.getByRole("combobox", { name: /invitation role/i });
    expect(roleTrigger).toBeTruthy();
    expect(screen.getByText("EMPLOYEE")).toBeTruthy();

    fireEvent.click(roleTrigger);
    expect(roleTrigger.getAttribute("aria-expanded")).toBe("true");

    expect(screen.getByRole("option", { name: "ADMIN" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "MANAGER" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "EMPLOYEE" })).toBeTruthy();

    fireEvent.click(screen.getByRole("option", { name: "ADMIN" }));
    expect(screen.getByText("ADMIN")).toBeTruthy();
  });
});

describe("AdminPage - save synchronization", () => {
  it("propagates a rename to the organization header and reloads the profile from the server", async () => {
    renderAdminPage("organization");
    const nameInput = await screen.findByDisplayValue("Lexorion Corp");
    fireEvent.change(nameInput, { target: { value: "Lexorion Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: /save profile changes/i }));

    expect(await screen.findByText(/organization profile updated successfully/i)).toBeTruthy();
    expect(updateOrganization).toHaveBeenCalledWith(expect.objectContaining({ name: "Lexorion Renamed" }));
    expect(mockRefreshOrganizations).toHaveBeenCalledTimes(1);
    // Initial load plus the authoritative post-save GET; the form stays mounted on the same page.
    expect(getOrganization).toHaveBeenCalledTimes(2);
    expect(screen.getByDisplayValue("Lexorion Renamed")).toBeTruthy();

    cleanup();
    renderAdminPage("organization");
    expect(await screen.findByDisplayValue("Lexorion Renamed")).toBeTruthy();
  });

  it("clears the branding display name and keeps it cleared after a fresh GET", async () => {
    renderSettingsSection("settings");
    const branding = await screen.findByDisplayValue("Lexorion Portal");
    fireEvent.change(branding, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /save settings changes/i }));

    expect(await screen.findByText(/organization settings updated successfully/i)).toBeTruthy();
    expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ brandingDisplayName: "" }));
    expect(testState.org.settings.brandingDisplayName).toBeNull();
    expect((document.querySelector('input[name="brandingDisplayName"]') as HTMLInputElement).value).toBe("");

    cleanup();
    renderSettingsSection("settings");
    await screen.findByText("Regional & Localization Defaults");
    expect((document.querySelector('input[name="brandingDisplayName"]') as HTMLInputElement).value).toBe("");
  });

  it("keeps the user's edits and shows the server error when a save fails", async () => {
    testState.updateShouldFail = true;
    renderAdminPage("organization");
    const nameInput = await screen.findByDisplayValue("Lexorion Corp");
    fireEvent.change(nameInput, { target: { value: "Unsaved Name" } });
    fireEvent.click(screen.getByRole("button", { name: /save profile changes/i }));

    expect(await screen.findByText("Failed to update organization profile")).toBeTruthy();
    expect(screen.getByDisplayValue("Unsaved Name")).toBeTruthy();
    expect(mockRefreshOrganizations).not.toHaveBeenCalled();
    expect(getOrganization).toHaveBeenCalledTimes(1);
  });

  it("keeps the form on screen and explains when the save succeeded but the reload failed", async () => {
    renderAdminPage("organization");
    const nameInput = await screen.findByDisplayValue("Lexorion Corp");
    fireEvent.change(nameInput, { target: { value: "Saved Name" } });
    testState.shouldFail = true;
    fireEvent.click(screen.getByRole("button", { name: /save profile changes/i }));

    expect(await screen.findByText(/your changes were saved, but the latest values could not be reloaded/i)).toBeTruthy();
    expect(screen.getByDisplayValue("Saved Name")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^retry$/i })).toBeNull();
    expect(mockRefreshOrganizations).toHaveBeenCalledTimes(1);
  });
});
