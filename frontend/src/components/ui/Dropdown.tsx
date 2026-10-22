import { useEffect, useRef, useState } from "react";
import { SearchSelect, type SelectOption } from "./SearchSelect";

export type DropdownOption = SelectOption;

interface Props {
  label: string;
  options: DropdownOption[];
  /** Submitted with the surrounding form under this name. */
  name?: string;
  /** Controlled value. Omit it and use `defaultValue` for a form-managed field. */
  value?: string;
  defaultValue?: string;
  onChange?(value: string): void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  className?: string;
  /** Search box in the menu; on by default for longer lists. */
  searchable?: boolean;
  /** Compact control without a visible label (for table cells); the label is still announced. */
  hideLabel?: boolean;
}

/**
 * Horizon's dropdown: the shared custom SearchSelect, usable both controlled and inside plain `<form>`s.
 * The value is submitted through a visually hidden text input so `required` is enforced by the browser
 * exactly like a native select.
 */
export function Dropdown({ label, options, name, value, defaultValue = "", onChange, required = false, disabled, placeholder = "Choose…", hint, className, searchable, hideLabel = false }: Props) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const root = useRef<HTMLDivElement>(null);
  // Native selects return to their default on form.reset(); do the same.
  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const reset = () => setInternal(defaultValue);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultValue]);
  return <div ref={root} className={`dropdown-field ${className ?? ""}`}>
    <SearchSelect label={hideLabel ? undefined : label} ariaLabel={label} compact={hideLabel} value={current} options={options} required={required} disabled={disabled} hint={hint}
      placeholder={placeholder} searchable={searchable ?? options.length > 7} searchPlaceholder={`Search ${label.toLowerCase()}…`}
      onChange={(next) => { if (value === undefined) setInternal(next); onChange?.(next); }} />
    {name && <input className="dropdown-value" name={name} value={current} required={required} tabIndex={-1} aria-hidden="true"
      onChange={() => undefined} />}
  </div>;
}
