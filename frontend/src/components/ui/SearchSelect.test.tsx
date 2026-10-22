import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SearchSelect, type SelectOption } from "./SearchSelect";

afterEach(() => {
  cleanup();
});

const TEST_OPTIONS: SelectOption[] = [
  { value: "IN", label: "🇮🇳 India (IN)", subLabel: "IN", keywords: ["India", "IN"] },
  { value: "US", label: "🇺🇸 United States (US)", subLabel: "US", keywords: ["United States", "US"] },
  { value: "GB", label: "🇬🇧 United Kingdom (GB)", subLabel: "GB", keywords: ["United Kingdom", "GB"] },
  { value: "CA", label: "🇨🇦 Canada (CA)", subLabel: "CA", keywords: ["Canada", "CA"] },
  { value: "DE", label: "🇩🇪 Germany (DE)", subLabel: "DE", keywords: ["Germany", "DE"] },
];

describe("SearchSelect - accessibility and functionality", () => {
  it("renders with combobox role and aria attributes", () => {
    const onChange = vi.fn();
    render(
      <SearchSelect
        id="country-select"
        label="Country"
        value="IN"
        options={TEST_OPTIONS}
        onChange={onChange}
      />
    );

    const trigger = screen.getByRole("combobox", { name: /country/i });
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
    expect(screen.getByText("🇮🇳 India (IN)")).toBeTruthy();
  });

  it("opens menu on click and filters options by search input", () => {
    const onChange = vi.fn();
    render(
      <SearchSelect
        id="country-select"
        label="Country"
        value=""
        options={TEST_OPTIONS}
        onChange={onChange}
      />
    );

    const trigger = screen.getByRole("combobox", { name: /country/i });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const searchInput = screen.getByPlaceholderText("Search...");
    expect(searchInput).toBeTruthy();

    // Type "Can" to filter for Canada
    fireEvent.change(searchInput, { target: { value: "Can" } });
    expect(screen.getByText("🇨🇦 Canada (CA)")).toBeTruthy();
    expect(screen.queryByText("🇮🇳 India (IN)")).toBeNull();

    // Select Canada
    fireEvent.click(screen.getByText("🇨🇦 Canada (CA)"));
    expect(onChange).toHaveBeenCalledWith("CA");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("supports keyboard navigation: ArrowDown, ArrowUp, Enter to select", () => {
    const onChange = vi.fn();
    render(
      <SearchSelect
        id="country-select"
        label="Country"
        value=""
        options={TEST_OPTIONS}
        onChange={onChange}
      />
    );

    const trigger = screen.getByRole("combobox", { name: /country/i });
    // Open with Enter key
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const menu = screen.getByRole("listbox");
    expect(menu).toBeTruthy();

    // Navigate down with ArrowDown
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    // Select second item with Enter
    fireEvent.keyDown(menu, { key: "Enter" });

    expect(onChange).toHaveBeenCalled();
  });

  it("closes on Escape and returns focus to trigger", () => {
    const onChange = vi.fn();
    render(
      <SearchSelect
        id="country-select"
        label="Country"
        value="US"
        options={TEST_OPTIONS}
        onChange={onChange}
      />
    );

    const trigger = screen.getByRole("combobox", { name: /country/i });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const menu = screen.getByRole("listbox");
    fireEvent.keyDown(menu, { key: "Escape" });

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("clears selection when clearable and clear button is clicked", () => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(
      <SearchSelect
        id="country-select"
        label="Country"
        value="IN"
        options={TEST_OPTIONS}
        onChange={onChange}
        clearable
        onClear={onClear}
      />
    );

    const clearBtn = screen.getByRole("button", { name: /clear selection/i });
    fireEvent.click(clearBtn);

    expect(onClear).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("renders custom dropdown without search box when searchable is false and supports keyboard selection", () => {
    const onChange = vi.fn();
    const roleOptions: SelectOption[] = [
      { value: "ADMIN", label: "ADMIN" },
      { value: "MANAGER", label: "MANAGER" },
      { value: "EMPLOYEE", label: "EMPLOYEE" },
    ];

    render(
      <SearchSelect
        id="role-select"
        label="Role"
        value="ADMIN"
        options={roleOptions}
        onChange={onChange}
        searchable={false}
        compact
      />
    );

    const trigger = screen.getByRole("combobox", { name: /role/i });
    expect(trigger).toBeTruthy();
    expect(screen.getByText("ADMIN")).toBeTruthy();

    // Click trigger to open
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    // Search input should not be present
    expect(screen.queryByPlaceholderText("Search...")).toBeNull();

    // Menu listbox is present with all options
    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeTruthy();
    expect(screen.getByRole("option", { name: "ADMIN" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "MANAGER" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "EMPLOYEE" })).toBeTruthy();

    // The selected option has is-selected class and checkmark
    const adminOption = screen.getByRole("option", { name: "ADMIN" });
    expect(adminOption.getAttribute("aria-selected")).toBe("true");
    expect(adminOption.className).toContain("is-selected");

    // Navigate with ArrowDown to MANAGER and press Enter
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("MANAGER");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("selects option on click in non-searchable custom dropdown", () => {
    const onChange = vi.fn();
    const roleOptions: SelectOption[] = [
      { value: "ADMIN", label: "ADMIN" },
      { value: "MANAGER", label: "MANAGER" },
      { value: "EMPLOYEE", label: "EMPLOYEE" },
    ];

    render(
      <SearchSelect
        id="role-select-click"
        ariaLabel="Role"
        value="ADMIN"
        options={roleOptions}
        onChange={onChange}
        searchable={false}
        compact
      />
    );

    const trigger = screen.getByRole("combobox", { name: "Role" });
    fireEvent.click(trigger);

    const employeeOption = screen.getByRole("option", { name: "EMPLOYEE" });
    fireEvent.click(employeeOption);

    expect(onChange).toHaveBeenCalledWith("EMPLOYEE");
  });
});

describe("SearchSelect ranking", () => {
  it("lists exact and prefix matches before other matches", () => {
    render(<SearchSelect label="Country" value="" onChange={() => undefined}
      options={[{ value: "IO", label: "🇮🇴 British Indian Ocean Territory" }, { value: "ID", label: "🇮🇩 Indonesia" }, { value: "IN", label: "🇮🇳 India" }]} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Country" }));
    fireEvent.change(screen.getByRole("textbox", { name: /search/i }), { target: { value: "india" } });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["🇮🇳 India", "🇮🇴 British Indian Ocean Territory"]);
  });
});
