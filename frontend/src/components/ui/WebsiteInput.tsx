import { useState, useEffect, type ChangeEvent } from "react";

export interface WebsiteInputProps {
  id?: string;
  name?: string;
  label?: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  className?: string;
}

// Retained for backward-compatibility with callers/tests that import it
export function extractDomainAndPath(url: string | null | undefined): string {
  if (!url) return "";
  let trimmed = url.trim();
  if (trimmed.startsWith("https://")) {
    return trimmed.slice(8);
  }
  if (trimmed.startsWith("http://")) {
    return trimmed.slice(7);
  }
  return trimmed;
}

// Validate website address as a plain string (accepts with or without http:// or https://)
export function validateWebsiteInput(input: string | null | undefined): {
  isValid: boolean;
  error: string | null;
  value: string;
  canonicalUrl: string;
} {
  const trimmed = (input || "").trim();
  if (!trimmed) {
    return { isValid: true, error: null, value: "", canonicalUrl: "" };
  }

  // Check for dangerous or unsupported protocols
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("file:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("ftp:")
  ) {
    return {
      isValid: false,
      error: "Unsupported protocol. Protocols like javascript:, data:, and file: are prohibited.",
      value: trimmed,
      canonicalUrl: "",
    };
  }

  const canonicalCandidate = trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;

  // Enforce 255 character limit
  if (trimmed.length > 255 || canonicalCandidate.length > 255) {
    return {
      isValid: false,
      error: "Website URL cannot exceed 255 characters.",
      value: trimmed,
      canonicalUrl: "",
    };
  }

  // Check for forbidden characters in URL hostname/path
  if (/[\s<>"'{}|\\^`[\]]/.test(trimmed)) {
    return {
      isValid: false,
      error: "Website contains invalid characters or whitespace.",
      value: trimmed,
      canonicalUrl: "",
    };
  }

  // Extract hostname part without protocol
  let withoutProtocol = trimmed;
  if (withoutProtocol.startsWith("https://")) {
    withoutProtocol = withoutProtocol.slice(8);
  } else if (withoutProtocol.startsWith("http://")) {
    withoutProtocol = withoutProtocol.slice(7);
  }

  // Hostname is before the first slash, query param, or hash
  const firstDelim = withoutProtocol.search(/[/\\?#]/);
  const hostAndPort = firstDelim === -1 ? withoutProtocol : withoutProtocol.slice(0, firstDelim);
  const hostname = hostAndPort.split(":")[0];

  if (!hostname) {
    return {
      isValid: false,
      error: "Please enter a valid hostname or domain (e.g. www.example.com or https://example.com).",
      value: trimmed,
      canonicalUrl: "",
    };
  }

  // Hostname validation: localhost, IPv4, or valid domain with at least one dot
  const isLocalhost = hostname === "localhost";
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  const isValidDomain = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
    hostname
  );

  if (!isLocalhost && !isIp && !isValidDomain) {
    return {
      isValid: false,
      error: "Please enter a valid hostname or domain (e.g. www.example.com or https://example.com).",
      value: trimmed,
      canonicalUrl: "",
    };
  }

  const canonicalUrl = trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;

  return { isValid: true, error: null, value: trimmed, canonicalUrl };
}

export function WebsiteInput({
  id = "website-input",
  name = "website",
  label = "Website",
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = "www.example.com",
  hint,
  error: externalError,
  className = "",
}: WebsiteInputProps) {
  const [internalError, setInternalError] = useState<string | null>(null);

  useEffect(() => {
    if (value && value.trim()) {
      const { isValid, error } = validateWebsiteInput(value);
      setInternalError(isValid ? null : error);
    } else {
      setInternalError(null);
    }
  }, [value]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    onChange(raw);
    if (raw.trim()) {
      const { isValid, error } = validateWebsiteInput(raw);
      setInternalError(isValid ? null : error);
    } else {
      setInternalError(null);
    }
  };

  const activeError = externalError || internalError;

  return (
    <div className={`website-input-container ${className} ${disabled ? "is-disabled" : ""}`}>
      {label && (
        <label htmlFor={id} className="website-input-label">
          {label}
          {required && <span className="field-required-asterisk" aria-hidden="true"> *</span>}
        </label>
      )}

      <input
        id={id}
        name={name}
        type="text"
        className={`website-input-field ${activeError ? "has-error" : ""}`}
        value={value ?? ""}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete="url"
        spellCheck="false"
        aria-label={label}
        aria-invalid={!!activeError}
        aria-describedby={activeError ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />

      {hint && !activeError && (
        <span id={`${id}-hint`} className="website-input-hint">
          {hint}
        </span>
      )}

      {activeError && (
        <span id={`${id}-error`} className="website-input-error" role="alert">
          {activeError}
        </span>
      )}
    </div>
  );
}
