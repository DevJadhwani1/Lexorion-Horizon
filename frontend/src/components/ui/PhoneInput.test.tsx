import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  PhoneInput,
  parsePhoneString,
  validatePhoneNumber,
} from "./PhoneInput";

afterEach(() => {
  cleanup();
});

describe("PhoneInput - parsing and international validation", () => {
  it("parses international calling codes and local numbers correctly", () => {
    const res1 = parsePhoneString("+919876543210");
    expect(res1.callingOption.callingCode).toBe("+91");
    expect(res1.callingOption.countryCode).toBe("IN");
    expect(res1.localNumber).toBe("9876543210");

    const res2 = parsePhoneString("+44 20 7946 0958");
    expect(res2.callingOption.callingCode).toBe("+44");
    expect(res2.callingOption.countryCode).toBe("GB");

    const res3 = parsePhoneString("+14155552671");
    expect(res3.callingOption.callingCode).toBe("+1");
  });

  it("handles duplicate calling codes retaining distinct country identities", () => {
    // Both US and CA use +1 calling code
    const parsedUS = parsePhoneString("+14155552671", "US");
    expect(parsedUS.callingOption.callingCode).toBe("+1");

    const parsedCA = parsePhoneString("+14165550199", "CA");
    expect(parsedCA.callingOption.callingCode).toBe("+1");
  });

  it("validates international phone lengths flexibly (ITU-T E.164: 4 to 15 digits)", () => {
    // Standard international number
    const valid = validatePhoneNumber("9876543210", "+91");
    expect(valid.isValid).toBe(true);
    expect(valid.e164).toBe("+919876543210");

    // Short valid international number (e.g. 4-6 local digits in smaller island states/networks)
    const shortValid = validatePhoneNumber("12345", "+676");
    expect(shortValid.isValid).toBe(true);

    // Too short (under 4 total digits)
    const tooShort = validatePhoneNumber("1", "+1");
    expect(tooShort.isValid).toBe(false);
    expect(tooShort.error).toContain("too short");

    // Too long (over 15 digits total under E.164)
    const tooLong = validatePhoneNumber("12345678901234567", "+1");
    expect(tooLong.isValid).toBe(false);
    expect(tooLong.error).toContain("cannot exceed 15 digits");

    // Invalid non-digit characters
    const withLetters = validatePhoneNumber("555-CALL-NOW", "+1");
    expect(withLetters.isValid).toBe(false);
    expect(withLetters.error).toContain("may only contain digits");
  });
});

describe("PhoneInput component", () => {
  it("renders with calling code trigger and local number input", () => {
    const onChange = vi.fn();
    render(
      <PhoneInput
        id="test-phone"
        label="Primary Phone"
        value="+919876543210"
        onChange={onChange}
      />
    );

    expect(screen.getByText("+91")).toBeTruthy();
    expect(screen.getByText("🇮🇳")).toBeTruthy();
    const input = screen.getByRole("textbox", { name: /primary phone local number/i }) as HTMLInputElement;
    expect(input.value).toBe("9876543210");
  });

  it("emits E.164 normalized value when local number is edited", () => {
    const onChange = vi.fn();
    render(
      <PhoneInput
        id="test-phone"
        label="Primary Phone"
        value="+14155550000"
        onChange={onChange}
      />
    );

    const input = screen.getByRole("textbox", { name: /primary phone local number/i });
    fireEvent.change(input, { target: { value: "415 555 1234" } });

    expect(onChange).toHaveBeenCalledWith("+14155551234");
  });

  it("displays validation error when letters or illegal characters are entered", () => {
    const onChange = vi.fn();
    render(
      <PhoneInput
        id="test-phone"
        label="Primary Phone"
        value=""
        onChange={onChange}
      />
    );

    const input = screen.getByRole("textbox", { name: /primary phone local number/i });
    fireEvent.change(input, { target: { value: "abc" } });

    expect(screen.getByRole("alert").textContent).toContain("may only contain digits");
  });
});
