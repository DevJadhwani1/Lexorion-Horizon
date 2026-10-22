// Regional defaults suggested when an organization picks its country.

export interface RegionalDefaults {
  currency: string;
  timeZone: string;
  dateFormat: string;
  locale: string;
}

/** What a new organization gets before anyone changes it (mirrors OrganizationSettings defaults). */
export const SERVER_DEFAULT_REGION: RegionalDefaults & { country: string } = {
  country: "US",
  currency: "USD",
  timeZone: "UTC",
  dateFormat: "YYYY-MM-DD",
  locale: "en-US",
};

const DEFAULTS_BY_COUNTRY: Record<string, RegionalDefaults> = {
  IN: { currency: "INR", timeZone: "Asia/Kolkata", dateFormat: "DD/MM/YYYY", locale: "en-IN" },
  US: { currency: "USD", timeZone: "America/New_York", dateFormat: "MM/DD/YYYY", locale: "en-US" },
  GB: { currency: "GBP", timeZone: "Europe/London", dateFormat: "DD/MM/YYYY", locale: "en-GB" },
  AE: { currency: "AED", timeZone: "Asia/Dubai", dateFormat: "DD/MM/YYYY", locale: "en-AE" },
  SG: { currency: "SGD", timeZone: "Asia/Singapore", dateFormat: "DD/MM/YYYY", locale: "en-SG" },
  AU: { currency: "AUD", timeZone: "Australia/Sydney", dateFormat: "DD/MM/YYYY", locale: "en-AU" },
  CA: { currency: "CAD", timeZone: "America/Toronto", dateFormat: "YYYY-MM-DD", locale: "en-CA" },
  DE: { currency: "EUR", timeZone: "Europe/Berlin", dateFormat: "DD/MM/YYYY", locale: "de-DE" },
  FR: { currency: "EUR", timeZone: "Europe/Paris", dateFormat: "DD/MM/YYYY", locale: "fr-FR" },
  NP: { currency: "NPR", timeZone: "Asia/Kathmandu", dateFormat: "YYYY-MM-DD", locale: "en-NP" },
  BD: { currency: "BDT", timeZone: "Asia/Dhaka", dateFormat: "DD/MM/YYYY", locale: "en-BD" },
  LK: { currency: "LKR", timeZone: "Asia/Colombo", dateFormat: "YYYY-MM-DD", locale: "en-LK" },
};

export function regionalDefaultsFor(country: string | null | undefined): RegionalDefaults | null {
  return country ? DEFAULTS_BY_COUNTRY[country.toUpperCase()] ?? null : null;
}

/** True while every regional setting still holds the value a new organization starts with. */
export function isUntouchedServerDefault(settings: Partial<RegionalDefaults & { country: string }> | null | undefined): boolean {
  if (!settings) return true;
  return (Object.keys(SERVER_DEFAULT_REGION) as (keyof typeof SERVER_DEFAULT_REGION)[])
    .every((key) => (settings[key] || SERVER_DEFAULT_REGION[key]) === SERVER_DEFAULT_REGION[key]);
}

export const LOCALE_OPTIONS: { value: string; label: string }[] = [
  ["en-IN", "English (India) — 12,34,567.89"],
  ["hi-IN", "Hindi (India)"],
  ["en-US", "English (United States) — 1,234,567.89"],
  ["en-GB", "English (United Kingdom)"],
  ["en-AE", "English (United Arab Emirates)"],
  ["en-SG", "English (Singapore)"],
  ["en-AU", "English (Australia)"],
  ["en-CA", "English (Canada)"],
  ["en-NP", "English (Nepal)"],
  ["en-BD", "English (Bangladesh)"],
  ["en-LK", "English (Sri Lanka)"],
  ["de-DE", "German (Germany)"],
  ["fr-FR", "French (France)"],
].map(([value, label]) => ({ value, label }));

/** A local example number for the phone field, so +91 is not shown beside a US number. */
export function phonePlaceholderFor(country: string | null | undefined): string {
  switch ((country || "").toUpperCase()) {
    case "IN": return "98765 43210";
    case "GB": return "7400 123456";
    case "AE": return "50 123 4567";
    case "SG": return "8123 4567";
    case "AU": return "412 345 678";
    default: return "555 123 4567";
  }
}
