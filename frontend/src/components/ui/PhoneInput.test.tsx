import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { PhoneInput, checkPhone, parsePhoneString, phoneValueFor, validatePhoneNumber } from "./PhoneInput";

afterEach(cleanup);

describe("checkPhone", () => {
  it("accepts formatted numbers for India, the UK and the US and normalizes them to E.164", () => {
    expect(checkPhone("98765 43210", "IN")).toMatchObject({ status: "valid", e164: "+919876543210" });
    expect(checkPhone("+91-98765-43210", "IN")).toMatchObject({ status: "valid", e164: "+919876543210" });
    expect(checkPhone("022 2345 6789", "IN")).toMatchObject({ status: "valid", e164: "+912223456789" }); // landline
    expect(checkPhone("020 7946 0958", "GB")).toMatchObject({ status: "valid", e164: "+442079460958" });
    expect(checkPhone("(415) 555-2671", "US")).toMatchObject({ status: "valid", e164: "+14155552671" });
    expect(checkPhone("415.555.2671", "US")).toMatchObject({ status: "valid", e164: "+14155552671" });
  });

  it("lets a leading + code name its own country", () => {
    expect(checkPhone("+44 20 7946 0958", "IN")).toMatchObject({ status: "valid", e164: "+442079460958", country: "GB" });
  });

  it("explains invalid input instead of rejecting the + sign", () => {
    expect(checkPhone("", "IN")).toMatchObject({ status: "empty", error: null });
    expect(checkPhone("12345", "IN").error).toBe("This number is too short for India.");
    expect(checkPhone("555-CALL-NOW", "US").error).toContain("digits, spaces, +");
    expect(checkPhone("98765+43210", "IN").error).toContain("+ only at the start");
  });

  it("keeps invalid digits so a form cannot silently save a blank number", () => {
    expect(phoneValueFor("12345", "IN")).toBe("+9112345");
    expect(phoneValueFor("", "IN")).toBe("");
  });

  it("keeps the submit-time helpers working for stored values, including shared calling codes", () => {
    expect(parsePhoneString("+919876543210")).toMatchObject({ localNumber: "9876543210", callingOption: { countryCode: "IN" } });
    expect(parsePhoneString("+442079460958").callingOption.countryCode).toBe("GB");
    expect(validatePhoneNumber("4155552671", "+1")).toMatchObject({ isValid: true, e164: "+14155552671" });
    expect(validatePhoneNumber("12345", "+91").isValid).toBe(false);
    expect(validatePhoneNumber("", "+91").isValid).toBe(true);
  });
});

describe("PhoneInput", () => {
  it("shows the stored number with its country code", () => {
    render(<PhoneInput label="Primary phone" value="+919876543210" onChange={vi.fn()} />);
    expect(screen.getByText("+91")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Primary phone number" }) as HTMLInputElement).value).toBe("9876543210");
  });

  it("emits E.164 for formatted input and the typed digits while invalid", () => {
    const onChange = vi.fn();
    render(<PhoneInput label="Phone" value="" defaultCountryCode="US" onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "Phone number" });
    fireEvent.change(input, { target: { value: "(415) 555-2671" } });
    expect(onChange).toHaveBeenLastCalledWith("+14155552671");
    fireEvent.change(input, { target: { value: "415" } });
    expect(onChange).toHaveBeenLastCalledWith("+1415");
    expect(screen.getByRole("alert").textContent).toContain("too short");
  });

  it("switches the country when a pasted number carries another country code, and says so", () => {
    const onCountryChange = vi.fn();
    render(<PhoneInput label="Phone" value="" defaultCountryCode="IN" onChange={vi.fn()} onCountryChange={onCountryChange} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), { target: { value: "+44 20 7946 0958" } });
    expect(onCountryChange).toHaveBeenCalledWith("GB");
    expect(screen.getByText("+44")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("United Kingdom");
  });

  it("keeps the typed digits when the country changes and re-validates them", () => {
    const onChange = vi.fn();
    render(<PhoneInput label="Phone" value="" defaultCountryCode="GB" onChange={onChange} />);
    const input = screen.getByRole("textbox", { name: "Phone number" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "(415) 555-2671" } });
    expect(screen.getByRole("alert").textContent).toContain("United Kingdom");
    fireEvent.click(screen.getByRole("combobox", { name: "Phone country" }));
    fireEvent.change(screen.getByRole("textbox", { name: /search country/i }), { target: { value: "United States" } });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: /^🇺🇸 United States/ }));
    expect(input.value).toBe("(415) 555-2671");
    expect(onChange).toHaveBeenLastCalledWith("+14155552671");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not flag an optional blank field", () => {
    render(<PhoneInput label="Phone" value="" onChange={vi.fn()} />);
    fireEvent.blur(screen.getByRole("textbox", { name: "Phone number" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("(optional)")).toBeTruthy();
  });
});
