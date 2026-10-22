import { useState, useEffect, type ChangeEvent } from "react";
import {
  CALLING_CODE_OPTIONS,
  type CallingCodeOption,
} from "../../data/countries";
import { SearchSelect, type SelectOption } from "./SearchSelect";

export interface PhoneInputProps {
  id?: string;
  name?: string;
  label?: string;
  value: string | null | undefined;
  onChange: (e164Value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  className?: string;
  defaultCountryCode?: string;
}

// Convert CALLING_CODE_OPTIONS to SelectOption format for SearchSelect
const CALLING_CODE_SELECT_OPTIONS: SelectOption[] = CALLING_CODE_OPTIONS.map((opt) => ({
  value: opt.id,
  label: `${opt.flag} ${opt.countryName} (${opt.callingCode})`,
  subLabel: opt.countryCode,
  keywords: [opt.countryName, opt.countryCode, opt.callingCode, opt.callingCode.replace("+", "")],
}));

// Parse an incoming phone string into matched calling-code option and local number
export function parsePhoneString(
  phone: string | null | undefined,
  fallbackCountryCode = "US"
): { callingOption: CallingCodeOption; localNumber: string } {
  const fallback =
    CALLING_CODE_OPTIONS.find((opt) => opt.countryCode.toUpperCase() === fallbackCountryCode.toUpperCase()) ||
    CALLING_CODE_OPTIONS[0];

  if (!phone || !phone.trim()) {
    return { callingOption: fallback, localNumber: "" };
  }

  const cleaned = phone.trim();

  // If phone starts with '+', attempt to match calling code from longest to shortest
  if (cleaned.startsWith("+")) {
    const withoutPlus = cleaned.slice(1);
    // Sort calling codes descending by length so longer codes match first (e.g. +1242 before +1)
    const sortedOptions = [...CALLING_CODE_OPTIONS].sort(
      (a, b) => b.callingCode.length - a.callingCode.length
    );

    for (const opt of sortedOptions) {
      const optCodeWithoutPlus = opt.callingCode.slice(1);
      if (withoutPlus.startsWith(optCodeWithoutPlus)) {
        const local = withoutPlus.slice(optCodeWithoutPlus.length).trim();
        return { callingOption: opt, localNumber: local };
      }
    }
  }

  return { callingOption: fallback, localNumber: cleaned };
}

// Validate phone digits according to international E.164 standards (4 to 15 digits total)
export function validatePhoneNumber(
  localNumber: string,
  callingCode: string
): { isValid: boolean; error: string | null; e164: string } {
  const trimmed = localNumber.trim();
  if (!trimmed) {
    return { isValid: true, error: null, e164: "" };
  }

  // Reject characters other than digits, spaces, hyphens, parentheses
  if (/[^\d\s\-()]/g.test(trimmed)) {
    return {
      isValid: false,
      error: "Phone number may only contain digits, spaces, and hyphens.",
      e164: "",
    };
  }

  const digits = trimmed.replace(/\D/g, "");
  const callingDigits = callingCode.replace(/\D/g, "");
  const totalDigits = callingDigits.length + digits.length;

  if (digits.length === 0) {
    return { isValid: true, error: null, e164: "" };
  }

  // ITU-T E.164 standard: max 15 digits; minimum internationally is ~4 digits
  if (totalDigits < 5) {
    return {
      isValid: false,
      error: "Phone number is too short (must be at least 4 digits).",
      e164: "",
    };
  }

  if (totalDigits > 15) {
    return {
      isValid: false,
      error: "Phone number is too long (cannot exceed 15 digits under E.164 standard).",
      e164: "",
    };
  }

  const e164 = `${callingCode}${digits}`;
  return { isValid: true, error: null, e164 };
}

export function PhoneInput({
  id = "phone-input",
  name = "primaryPhone",
  label = "Phone Number",
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = "555 123 4567",
  hint,
  error: externalError,
  className = "",
  defaultCountryCode = "US",
}: PhoneInputProps) {
  const [selectedCallingId, setSelectedCallingId] = useState<string>(() => {
    const { callingOption } = parsePhoneString(value, defaultCountryCode);
    return callingOption.id;
  });
  const [localNumber, setLocalNumber] = useState<string>(() => {
    const { localNumber: parsed } = parsePhoneString(value, defaultCountryCode);
    return parsed;
  });
  const [internalError, setInternalError] = useState<string | null>(null);

  // Current calling option
  const currentCallingOption =
    CALLING_CODE_OPTIONS.find((opt) => opt.id === selectedCallingId) ||
    CALLING_CODE_OPTIONS[0];

  // Sync when external value prop changes
  useEffect(() => {
    const { callingOption, localNumber: parsed } = parsePhoneString(value, defaultCountryCode);
    setSelectedCallingId(callingOption.id);
    setLocalNumber(parsed);
    if (parsed) {
      const { isValid, error } = validatePhoneNumber(parsed, callingOption.callingCode);
      setInternalError(isValid ? null : error);
    } else {
      setInternalError(null);
    }
  }, [value, defaultCountryCode]);

  const handleCallingCodeChange = (newId: string) => {
    setSelectedCallingId(newId);
    const newOpt = CALLING_CODE_OPTIONS.find((opt) => opt.id === newId) || currentCallingOption;
    if (localNumber.trim()) {
      const { isValid, error, e164 } = validatePhoneNumber(localNumber, newOpt.callingCode);
      setInternalError(isValid ? null : error);
      onChange(isValid ? e164 : `${newOpt.callingCode}${localNumber.replace(/\D/g, "")}`);
    }
  };

  const handleNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalNumber(raw);
    const { isValid, error, e164 } = validatePhoneNumber(raw, currentCallingOption.callingCode);
    setInternalError(isValid ? null : error);
    if (!raw.trim()) {
      onChange("");
    } else if (isValid) {
      onChange(e164);
    } else {
      onChange(`${currentCallingOption.callingCode}${raw.replace(/\D/g, "")}`);
    }
  };

  const activeError = externalError || internalError;
  const digitsOnly = localNumber.replace(/\D/g, "");
  const e164Value = digitsOnly ? `${currentCallingOption.callingCode}${digitsOnly}` : "";

  return (
    <div className={`phone-input-container ${className} ${disabled ? "is-disabled" : ""}`}>
      {label && (
        <label htmlFor={`${id}-number`} className="phone-input-label">
          {label}
          {required && <span className="field-required-asterisk" aria-hidden="true"> *</span>}
        </label>
      )}

      {/* Hidden input storing normalized E.164 phone string */}
      {name && <input type="hidden" name={name} value={e164Value} />}

      <div className={`phone-input-group ${activeError ? "has-error" : ""}`}>
        <div className="phone-calling-code-picker">
          <SearchSelect
            id={`${id}-calling-code`}
            value={selectedCallingId}
            onChange={handleCallingCodeChange}
            options={CALLING_CODE_SELECT_OPTIONS}
            disabled={disabled}
            ariaLabel="Country calling code"
            renderSelected={(opt) => {
              const matched = CALLING_CODE_OPTIONS.find((c) => c.id === opt.value);
              return (
                <span className="phone-selected-code">
                  <span className="phone-flag" aria-hidden="true">
                    {matched?.flag}
                  </span>
                  <span className="phone-code-text">{matched?.callingCode}</span>
                </span>
              );
            }}
          />
        </div>

        <input
          id={`${id}-number`}
          type="tel"
          className="phone-number-field"
          value={localNumber}
          onChange={handleNumberChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete="tel-national"
          aria-label={`${label} local number`}
          aria-invalid={!!activeError}
          aria-describedby={activeError ? `${id}-error` : hint ? `${id}-hint` : undefined}
        />
      </div>

      {hint && !activeError && (
        <span id={`${id}-hint`} className="phone-input-hint">
          {hint}
        </span>
      )}

      {activeError && (
        <span id={`${id}-error`} className="phone-input-error" role="alert">
          {activeError}
        </span>
      )}
    </div>
  );
}
