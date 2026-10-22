import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { parsePhoneNumberFromString, validatePhoneNumberLength, type CountryCode } from "libphonenumber-js";
import { CALLING_CODE_OPTIONS, COUNTRIES, type CallingCodeOption } from "../../data/countries";
import { SearchSelect, type SelectOption } from "./SearchSelect";

/*
 * Country-aware phone input.
 * - Accepts what people paste: digits with spaces, hyphens, dots, parentheses, or a leading "+country code".
 * - Validates with libphonenumber-js metadata for the chosen country (mobile and landline numbers both pass).
 * - Emits E.164 (+919876543210) only when the number is valid; an empty optional field emits "".
 * - Never rewrites the digits the user typed. A "+code" that belongs to another country switches the country
 *   selector and says so; changing the country keeps the typed digits and re-validates them.
 * Limitation: the bundled "min" metadata checks lengths and leading digits per country, not every number range.
 */

const ALLOWED = /^[\d\s+().\-/]*$/;

export type PhoneStatus = "empty" | "valid" | "invalid";
export interface PhoneCheck { status: PhoneStatus; e164: string; country: string; error: string | null }

const countryName = (code: string) => COUNTRIES.find((country) => country.code === code)?.name ?? code;
const callingCodeOf = (code: string) => COUNTRIES.find((country) => country.code === code)?.callingCodes[0] ?? "";

/** Checks a phone number as typed, for the selected country. A leading "+" lets the number name its own country. */
export function checkPhone(input: string, country: string): PhoneCheck {
  const raw = input.trim();
  if (!raw || !/\d/.test(raw)) return raw ? { status: "invalid", e164: "", country, error: "Enter a phone number using digits." } : { status: "empty", e164: "", country, error: null };
  if (!ALLOWED.test(raw)) return { status: "invalid", e164: "", country, error: "Phone numbers can contain digits, spaces, +, hyphens, dots and parentheses only." };
  if (raw.indexOf("+") > 0 || (raw.match(/\+/g) ?? []).length > 1) return { status: "invalid", e164: "", country, error: "Use + only at the start, before the country code." };
  const international = raw.startsWith("+");
  const parsed = parsePhoneNumberFromString(raw, international ? undefined : (country as CountryCode));
  const detected = parsed?.country ?? country;
  if (parsed?.isValid()) return { status: "valid", e164: parsed.number, country: detected, error: null };
  const length = validatePhoneNumberLength(raw, international ? undefined : (country as CountryCode));
  const where = international && parsed?.country ? countryName(parsed.country) : countryName(country);
  const error = length === "TOO_SHORT" ? `This number is too short for ${where}.`
    : length === "TOO_LONG" ? `This number is too long for ${where}.`
      : length === "INVALID_COUNTRY" ? "That country code is not recognised. Check the digits after +."
        : `Enter a valid ${where} phone number.`;
  return { status: "invalid", e164: "", country: detected, error };
}

/**
 * Value reported to the parent. Invalid input keeps its digits (with the calling code) so a form's own
 * validation or the server rejects it visibly instead of silently saving a blank phone.
 */
export function phoneValueFor(input: string, country: string): string {
  const result = checkPhone(input, country);
  if (result.status !== "invalid") return result.e164;
  const digits = input.replace(/\D/g, "");
  return input.trim().startsWith("+") ? `+${digits}` : `${callingCodeOf(country)}${digits}`;
}

/** Splits a stored E.164 value into its country and national digits. */
export function parsePhoneString(phone: string | null | undefined, fallbackCountryCode = "US"): { callingOption: CallingCodeOption; localNumber: string } {
  const fallback = CALLING_CODE_OPTIONS.find((option) => option.countryCode === fallbackCountryCode.toUpperCase()) ?? CALLING_CODE_OPTIONS[0];
  const value = phone?.trim() ?? "";
  if (!value) return { callingOption: fallback, localNumber: "" };
  const parsed = parsePhoneNumberFromString(value, value.startsWith("+") ? undefined : (fallback.countryCode as CountryCode));
  if (!parsed) return { callingOption: fallback, localNumber: value };
  const option = CALLING_CODE_OPTIONS.find((item) => item.countryCode === parsed.country && item.callingCode === `+${parsed.countryCallingCode}`)
    ?? CALLING_CODE_OPTIONS.find((item) => item.callingCode === `+${parsed.countryCallingCode}`) ?? fallback;
  return { callingOption: option, localNumber: String(parsed.nationalNumber) };
}

/** Submit-time check used by forms that keep the E.164 value in state. */
export function validatePhoneNumber(localNumber: string, callingCode: string, country?: string): { isValid: boolean; error: string | null; e164: string } {
  // Without an explicit country, check the full international number so shared codes (+1, +7) resolve correctly.
  const result = country || !localNumber.trim() ? checkPhone(localNumber, country ?? "US")
    : checkPhone(localNumber.trim().startsWith("+") ? localNumber : `${callingCode} ${localNumber}`, "US");
  return { isValid: result.status !== "invalid", error: result.error, e164: result.e164 };
}

const COUNTRY_OPTIONS: SelectOption[] = COUNTRIES.filter((country) => country.callingCodes.length > 0).map((country) => ({
  value: country.code,
  label: `${country.flag} ${country.name}`,
  subLabel: country.callingCodes[0],
  keywords: [country.name, country.code, ...country.callingCodes, ...country.callingCodes.map((code) => code.replace("+", ""))],
}));

export interface PhoneInputProps {
  id?: string;
  name?: string;
  label?: string;
  /** Stored value in E.164 form, or empty. */
  value: string | null | undefined;
  /** Receives E.164 when valid, "" when empty, and the typed digits with the calling code while invalid. */
  onChange: (e164Value: string) => void;
  /** Called with the ISO country (IN, GB …) whenever it changes. */
  onCountryChange?: (country: string) => void;
  /** Called with the validation result on every change. */
  onValidityChange?: (check: PhoneCheck) => void;
  /** Optional form field name for the selected ISO country. */
  countryName?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  className?: string;
  defaultCountryCode?: string;
}

export function PhoneInput({
  id: explicitId, name = "primaryPhone", label = "Phone number", value, onChange, onCountryChange, onValidityChange, countryName: countryField,
  required = false, disabled = false, placeholder, hint, error: externalError, className = "", defaultCountryCode = "IN",
}: PhoneInputProps) {
  const generatedId = useId();
  const id = explicitId ?? `phone-${generatedId}`;
  const initial = parsePhoneString(value, defaultCountryCode);
  const [country, setCountry] = useState(initial.callingOption.countryCode);
  const [text, setText] = useState(initial.localNumber);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const numberRef = useRef<HTMLInputElement>(null);
  const lastEmitted = useRef(value ?? "");

  // Adopt a new value from the parent only when it differs from what this input last reported.
  useEffect(() => {
    if ((value ?? "") === lastEmitted.current) return;
    const parsed = parsePhoneString(value, defaultCountryCode);
    lastEmitted.current = value ?? "";
    setCountry(parsed.callingOption.countryCode);
    setText(parsed.localNumber);
  }, [value, defaultCountryCode]);

  const check = checkPhone(text, country);
  const requiredMissing = required && check.status === "empty";
  const message = externalError ?? (check.status === "invalid" ? check.error : requiredMissing && touched ? "Enter a phone number." : null);

  useEffect(() => { numberRef.current?.setCustomValidity(check.status === "invalid" ? check.error ?? "Invalid phone number" : ""); }, [check.status, check.error]);

  const report = (nextText: string, nextCountry: string) => {
    const result = checkPhone(nextText, nextCountry);
    const emitted = phoneValueFor(nextText, nextCountry);
    lastEmitted.current = emitted;
    onChange(emitted);
    onValidityChange?.(result);
    return result;
  };

  const changeNumber = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setText(next);
    setTouched(true);
    const result = report(next, country);
    // A pasted "+44 …" names its own country: follow it, visibly.
    if (next.trim().startsWith("+") && result.country && result.country !== country && COUNTRIES.some((item) => item.code === result.country)) {
      setCountry(result.country);
      onCountryChange?.(result.country);
      setNote(`Country set to ${countryName(result.country)} from the number you entered.`);
    } else setNote("");
  };

  const changeCountry = (next: string) => {
    setCountry(next);
    onCountryChange?.(next);
    // The typed digits are kept exactly; they are re-checked against the new country.
    setNote(text.trim() && !text.trim().startsWith("+") ? `Now checking this number as ${countryName(next)} (${callingCodeOf(next)}).` : "");
    report(text, next);
  };

  const describedBy = [message ? `${id}-error` : "", note ? `${id}-note` : "", hint ? `${id}-hint` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`phone-input-container ${className} ${disabled ? "is-disabled" : ""}`}>
      {label && <label htmlFor={`${id}-number`} className="phone-input-label">
        {label}{required ? <span className="field-required-asterisk" aria-hidden="true"> *</span> : <span className="field-optional"> (optional)</span>}
      </label>}
      {name && <input type="hidden" name={name} value={phoneValueFor(text, country)} />}
      {countryField && <input type="hidden" name={countryField} value={country} />}
      <div className={`phone-input-group ${message ? "has-error" : ""}`}>
        <div className="phone-calling-code-picker">
          <SearchSelect id={`${id}-country`} value={country} onChange={changeCountry} options={COUNTRY_OPTIONS} disabled={disabled}
            ariaLabel={`${label} country`} searchPlaceholder="Search country or code…" minMenuWidth={280}
            renderSelected={(option) => <span className="phone-selected-code"><span className="phone-flag" aria-hidden="true">{COUNTRIES.find((item) => item.code === option.value)?.flag}</span><span className="phone-code-text">{callingCodeOf(option.value)}</span></span>} />
        </div>
        <input id={`${id}-number`} ref={numberRef} type="tel" inputMode="tel" className="phone-number-field" value={text} onChange={changeNumber}
          onBlur={() => setTouched(true)} placeholder={placeholder ?? (country === "IN" ? "98765 43210" : "Phone number")} disabled={disabled} required={required}
          autoComplete="tel" aria-label={`${label} number`} aria-invalid={Boolean(message)} aria-describedby={describedBy} />
      </div>
      {note && !message && <span id={`${id}-note`} className="phone-input-hint" role="status">{note}</span>}
      {hint && !message && <span id={`${id}-hint`} className="phone-input-hint">{hint}</span>}
      {message && <span id={`${id}-error`} className="phone-input-error" role="alert">{message}</span>}
    </div>
  );
}
