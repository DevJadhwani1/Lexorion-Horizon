import { Dropdown, type DropdownOption } from "./Dropdown";
import { CURRENCIES, formatCurrencyLabel } from "../../data/currencies";

const CURRENCY_OPTIONS: DropdownOption[] = CURRENCIES.map((c) => ({ value: c.code, label: formatCurrencyLabel(c), keywords: [c.code, c.name] }));

/** ISO 4217 currency picker for plain `<form>`s; submits the three-letter code under `name`. */
export function CurrencyDropdown({ name = "currency", label = "Currency", defaultValue, hint, required = true }: {
  name?: string; label?: string; defaultValue?: string; hint?: string; required?: boolean;
}) {
  const code = defaultValue?.toUpperCase();
  // Keep a stored code that is not in the list selectable rather than silently replacing it.
  const options = !code || CURRENCY_OPTIONS.some((o) => o.value === code) ? CURRENCY_OPTIONS : [{ value: code, label: code }, ...CURRENCY_OPTIONS];
  return <Dropdown key={code} label={label} name={name} defaultValue={code} options={options} hint={hint} required={required} searchable placeholder="Select currency..." />;
}
